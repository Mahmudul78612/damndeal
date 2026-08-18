const Order = require("../../../models/Order");
const Product = require("../../../models/Product");
const Customer = require("../../../models/Customer");
const User = require("../../../models/User");
const Address = require("../../../models/Address");
const PartnerKyc = require("../../../models/PartnerKyc");
const InventoryLog = require("../../../models/InventoryLog");
const { calculateFees, calcDistanceKm, getSetting } = require("../../../services/fee.service");
const cjService = require("../../../services/cj.service");
const { notifyOrderPlaced, notifyOrderCancelled } = require("../../../services/notification.service");
const magicClub = require("../../../services/magicclub.service");
const { refundPaidOrder } = require("../../../services/refund.service");
const { checkOrderAllowed } = require("../../../services/orderGuard.service");
const crypto = require("crypto");

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DD-${ts}-${rand}`;
}

async function _calculateCJDeliverySummary(rawItems, productMap, region = "IN") {
  const cjLines = rawItems
    .map((item) => {
      const p = productMap[item.product?.toString()];
      if (!p || p.source !== "cj") return null;
      const vid = p.cjVariantId || (Array.isArray(p.cjVariants) ? p.cjVariants[0]?.cjVid : null);
      if (!vid) return null;
      return {
        vid,
        quantity: parseInt(item.quantity, 10) || 1,
        weight: parseFloat(p.weight) || 500,
      };
    })
    .filter(Boolean);

  if (!cjLines.length) return { feeInr: 0, feeUsd: 0, minDays: null, maxDays: null };

  const usdRate = parseFloat(await getSetting("cj_usd_inr_rate", 84)) || 84;
  const isUS = region === "US";

  let totalUsd = 0;
  let minDays = null;
  let maxDays = null;

  for (const line of cjLines) {
    try {
      const estimate = await cjService.estimateFreightSummary({
        startCountryCode: isUS ? "US" : "CN",
        endCountryCode: isUS ? "US" : "IN",
        quantity: line.quantity,
        weight: line.weight,
        vid: line.vid,
      });

      totalUsd += parseFloat(estimate.feeUsd || 0);

      if (estimate.minDays != null) minDays = minDays == null ? estimate.minDays : Math.max(minDays, estimate.minDays);
      if (estimate.maxDays != null) maxDays = maxDays == null ? estimate.maxDays : Math.max(maxDays, estimate.maxDays);
    } catch (_) {
      // Ignore per-line freight failures and continue with others.
    }
  }

  return {
    // US pays freight in USD as-is; India converts USD → INR.
    feeUsd: Math.round(totalUsd * 100) / 100,
    feeInr: Math.round(totalUsd * usdRate * 100) / 100,
    minDays,
    maxDays,
  };
}

// GET /user/orders/delivery-estimate — preview fees before placing order
// Query: partnerId, addressId, platform, productIds (comma-separated), paymentMethod
async function getDeliveryEstimate(req, res) {
  const { partnerId, addressId, subtotal = 0, platform = "damndeal", productIds = "", paymentMethod = "" } = req.query;
  if (!partnerId || !addressId) {
    return res.status(400).json({ success: false, message: "partnerId and addressId required" });
  }

  const [address, kyc] = await Promise.all([
    Address.findOne({ _id: addressId, user: req.user.userId }),
    PartnerKyc.findOne({ partner: partnerId, status: "approved" }),
  ]);
  if (!address) return res.status(404).json({ success: false, message: "Address not found" });

  let distanceKm = 0;
  let freeDeliveryAbove = 0;

  let maxRadiusKmOverride = null;
  if (kyc && kyc.location && kyc.location.coordinates) {
    const [shopLng, shopLat] = kyc.location.coordinates;
    distanceKm = calcDistanceKm(address.lat, address.lng, shopLat, shopLng);
    freeDeliveryAbove = kyc.freeDeliveryAbove || 0;
    // This shop's own reach beats the platform-wide number.
    if (kyc.deliveryRadiusKm > 0) maxRadiusKmOverride = kyc.deliveryRadiusKm;
  }

  // Per-product overrides
  let productOverrides = [];
  if (productIds) {
    const ids = String(productIds).split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length) {
      const prods = await Product.find({ _id: { $in: ids } }).select("deliveryFee");
      productOverrides = prods.map((p) => p.deliveryFee);
    }
  }

  const fees = await calculateFees({
    subtotal: parseFloat(subtotal) || 0,
    discount: 0,
    distanceKm,
    freeDeliveryAbove,
    platform,
    productOverrides,
    paymentMethod,
    region: req.region === "US" ? "US" : "IN",
    maxRadiusKmOverride,
  });

  if (fees.error) {
    return res.status(400).json({ success: false, message: fees.error });
  }

  if (!freeDeliveryAbove) {
    freeDeliveryAbove = await getSetting("free_delivery_above", 0);
  }

  // US sales tax rate so the checkout can show it added on top (pass-through).
  const usSalesTaxRate = req.region === "US" ? (parseFloat(await getSetting("us_sales_tax_percent")) || 0) : 0;

  return res.json({
    success: true,
    estimate: {
      ...fees,
      freeDeliveryAbove,
      usSalesTaxRate,
      shopName: kyc?.organizationName || "DamnDeal",
    },
  });
}

// POST /user/orders — place order from app
async function placeOrder(req, res) {
  try {
  const userId = req.user.userId;
  const { partnerId, items: rawItems, addressId, paymentMethod, note, platform = "damndeal", magicClubRedeem } = req.body;
  // SECURITY: never trust client-sent discount/price. No coupon system yet → force 0.
  // When coupons are added, validate code server-side and recompute discount here.
  const discount = 0;

  if (!partnerId || !rawItems?.length || !addressId) {
    return res.status(400).json({ success: false, message: "partnerId, items, addressId required" });
  }

  // Anti-abuse: duplicate orders, burst ordering, datacenter/VPN IPs
  const blockMessage = await checkOrderAllowed(req, userId, rawItems, addressId);
  if (blockMessage) {
    return res.status(429).json({ success: false, message: blockMessage });
  }

  // Get delivery address
  const address = await Address.findOne({ _id: addressId, user: userId });
  if (!address) return res.status(404).json({ success: false, message: "Address not found" });

  // Get partner shop location & settings (optional for platform/admin products)
  const kyc = await PartnerKyc.findOne({ partner: partnerId, status: "approved" });
  const isPlatformOrder = !kyc; // Admin-added products won't have partner KYC

  // Resolve products
  const productIds = rawItems.map((i) => i.product);
  const products = await Product.find({
    _id: { $in: productIds }, partner: partnerId,
    isActive: true, approvalStatus: "approved",
  });

  if (products.length !== rawItems.length) {
    return res.status(400).json({ success: false, message: "One or more products unavailable" });
  }

  const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));
  let subtotal = 0, totalGst = 0, costTotal = 0;
  const orderItems = [];

  for (const item of rawItems) {
    const p = productMap[item.product];
    const isCj = p.source === "cj";
    const selectedCjVariant = isCj && item.cjVid && Array.isArray(p.cjVariants)
      ? p.cjVariants.find((v) => String(v.cjVid) === String(item.cjVid))
      : null;

    const effectivePrice = selectedCjVariant?.sellingPrice ?? p.sellingPrice;
    const effectiveMrp = selectedCjVariant?.mrp ?? p.mrp;
    const effectiveStock = selectedCjVariant?.stock ?? p.stock;

    if (effectiveStock < item.quantity) {
      return res.status(400).json({ success: false, message: `"${p.name}" is out of stock (${effectiveStock} left)` });
    }

    let gstAmount;
    if (p.gstInclusive) {
      const priceExGst = effectivePrice / (1 + p.gstPercent / 100);
      gstAmount = (effectivePrice - priceExGst) * item.quantity;
    } else {
      gstAmount = (effectivePrice * p.gstPercent / 100) * item.quantity;
    }

    const lineTotal = effectivePrice * item.quantity;
    subtotal += lineTotal;
    totalGst += gstAmount;
    costTotal += p.costPrice * item.quantity;

    orderItems.push({
      product: p._id, name: p.name, quantity: item.quantity, unit: p.unit,
      price: effectivePrice,
      cjVid: item.cjVid || null,
      gstPercent: p.gstPercent,
      gstAmount: Math.round(gstAmount * 100) / 100,
      total: Math.round(lineTotal * 100) / 100,
    });
  }

  // Calculate distance & fees (platform-aware)
  let distanceKm = 0;
  let fees;

  if (kyc && kyc.location && kyc.location.coordinates) {
    const [shopLng, shopLat] = kyc.location.coordinates;
    distanceKm = calcDistanceKm(address.lat, address.lng, shopLat, shopLng);
    fees = await calculateFees({
      subtotal,
      discount,
      distanceKm,
      freeDeliveryAbove: kyc.freeDeliveryAbove || 0,
      platform,
      productOverrides: products.map((p) => p.deliveryFee),
      paymentMethod,
      region: req.region === "US" ? "US" : "IN",
      // This shop's own reach beats the platform-wide number.
      maxRadiusKmOverride: kyc.deliveryRadiusKm > 0 ? kyc.deliveryRadiusKm : null,
    });
  } else {
    // Platform/admin order — use default fees
    fees = await calculateFees({
      subtotal,
      discount,
      distanceKm: 0,
      freeDeliveryAbove: 0,
      platform,
      productOverrides: products.map((p) => p.deliveryFee),
      paymentMethod,
      region: req.region === "US" ? "US" : "IN",
    });
  }

  if (fees.error) {
    return res.status(400).json({ success: false, message: fees.error });
  }

  const { deliveryFee, freeDeliveryApplied, platformFee, codFee, estimatedDeliveryMinutes, minOrderAmount } = fees;

  // Minimum order check (uses platform-specific setting from calculateFees)
  if (minOrderAmount > 0 && subtotal - discount < minOrderAmount) {
    const cur = req.region === "US" ? "$" : "₹";
    return res.status(400).json({ success: false, message: `Minimum order amount is ${cur}${minOrderAmount}` });
  }

  const hasCJItems = products.some((p) => p.source === "cj");
  let cjDelivery = { feeInr: 0, feeUsd: 0, minDays: null, maxDays: null };
  if (hasCJItems) {
    cjDelivery = await _calculateCJDeliverySummary(rawItems, productMap, req.region === "US" ? "US" : "IN");
  }

  // Free shipping for CJ items (both regions): the CJ freight is already baked into
  // the product's landed cost, so the selling price covers it. This also keeps the
  // checkout total identical to the Razorpay/Stripe amount (no hidden freight added).
  const cjFee = 0;
  const finalDeliveryFee = Math.round((deliveryFee + cjFee) * 100) / 100;

  // US sales tax — added ON TOP at checkout (pass-through: customer pays it, we
  // remit it to the state). It is NOT part of profit and never reduces margin.
  let salesTaxAmount = 0;
  if (req.region === "US") {
    const usRate = parseFloat(await getSetting("us_sales_tax_percent")) || 0;
    salesTaxAmount = Math.round((subtotal - discount) * (usRate / 100) * 100) / 100;
  }

  // Grand total = subtotal - discount + deliveryFee + platformFee + codFee + salesTax
  let grandTotal = Math.round((subtotal - discount + finalDeliveryFee + platformFee + (codFee || 0) + salesTaxAmount) * 100) / 100;
  // Profit excludes tax (pass-through). Cost already includes CJ shipping (landed).
  const profit = Math.round((subtotal - discount - costTotal) * 100) / 100;

  // ── Magic Club redemption (best-effort; never block order) ───────────────
  let mcRedeemPoints = 0, mcRedeemAmount = 0;
  if (magicClubRedeem && Number(magicClubRedeem.points) > 0) {
    const reqPoints = Math.floor(Number(magicClubRedeem.points));
    const reqAmount = await magicClub.pointsToRupees(reqPoints);
    // Cap redemption at the order grandTotal (no negative orders)
    const capPoints = Math.min(reqPoints, await magicClub.rupeesToPoints(grandTotal));
    if (capPoints > 0) {
      const capAmount = await magicClub.pointsToRupees(capPoints);
      mcRedeemPoints = capPoints;
      mcRedeemAmount = Math.round(capAmount * 100) / 100;
      grandTotal = Math.round((grandTotal - mcRedeemAmount) * 100) / 100;
    }
    void reqAmount;
  }

  let finalEstimatedDeliveryMinutes = estimatedDeliveryMinutes;
  if (hasCJItems && cjDelivery.maxDays != null) {
    finalEstimatedDeliveryMinutes = parseInt(cjDelivery.maxDays, 10) * 24 * 60;
  }

  // Region/currency from the request (damndeal.com => US/USD, else IN/INR)
  const orderRegion = req.region === "US" ? "US" : "IN";

  /* Pin the fulfilling store onto the order.
     Resolved once, here, and never recomputed: a store's radius or hours can
     change tomorrow, but this order was packed by whoever covered the address
     tonight, and the queue, the rider and the reporting all have to keep
     pointing at them. Only our own stores are recorded - a partner-shop order
     is already answered by `partner`. */
  let fulfillingStore = null;
  if (platform === "ddgo" && Number.isFinite(address.lat) && Number.isFinite(address.lng)) {
    try {
      const { storesCovering } = require("../../../services/serviceability.service");
      const covering = await storesCovering({
        lat: address.lat, lng: address.lng, region: orderRegion, includeClosed: true,
      });
      const own = covering.find((c) => c.type === "darkstore");
      if (own) fulfillingStore = own.id;
    } catch (e) {
      // A resolver failure must not block a paid order; it only costs the
      // store attribution, which an admin can set later.
      console.error("[ORDER] store resolve failed:", e.message);
    }
  }

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    user: userId, partner: partnerId,
    platform: platform === "ddgo" ? "ddgo" : "damndeal",
    store: fulfillingStore,
    region: orderRegion,
    currency: orderRegion === "US" ? "USD" : "INR",
    taxAmount: salesTaxAmount,
    items: orderItems,
    subtotal: Math.round(subtotal * 100) / 100,
    totalGst: Math.round(totalGst * 100) / 100,
    discount,
    deliveryFee: finalDeliveryFee,
    freeDeliveryApplied,
    platformFee,
    codFee: codFee || 0,
    grandTotal,
    costTotal: Math.round(costTotal * 100) / 100,
    profit,
    distanceKm,
    estimatedDeliveryMinutes: finalEstimatedDeliveryMinutes,
    fulfillmentType: isPlatformOrder ? "platform" : (kyc.selfDeliveryEnabled ? "self" : "platform"),
    deliveryAddress: {
      label: address.label, address: address.address, landmark: address.landmark,
      city: address.city, state: address.state, pincode: address.pincode,
      lat: address.lat, lng: address.lng,
    },
    deliveryOtp: crypto.randomInt(1000, 9999).toString(),
    paymentMethod: paymentMethod || "cod",
    // Online methods (razorpay/stripe) stay pending until payment is confirmed.
    paymentStatus: (paymentMethod === "cod" || paymentMethod === "razorpay" || paymentMethod === "stripe") ? "pending" : "paid",
    status: "placed", source: "app",
    note: note || "",
    magicClub: mcRedeemPoints > 0 ? {
      redeemedPoints: mcRedeemPoints,
      redeemedAmount: mcRedeemAmount,
      debit: { token: magicClubRedeem.token || null, transactionId: null, confirmedAt: null, reversedAt: null },
    } : undefined,
  });

  // Confirm Magic Club debit (best-effort) — only after order is persisted.
  if (mcRedeemPoints > 0 && magicClubRedeem.token) {
    try {
      const r = await magicClub.confirmDebit(magicClubRedeem.token);
      if (r.ok && r.data) {
        order.magicClub = order.magicClub || {};
        order.magicClub.debit = order.magicClub.debit || {};
        order.magicClub.debit.transactionId = r.data.transactionId || null;
        order.magicClub.debit.confirmedAt = new Date();
        await order.save();
      } else {
        console.warn("[MAGICCLUB] confirm-debit failed for order", order.orderNumber, r);
      }
    } catch (e) {
      console.error("[MAGICCLUB] confirm-debit threw:", e.message);
    }
  }

  /* Deduct stock from wherever it actually lives.
     A dark-store order comes off that store's shelf: two stores hold the same
     milk independently, and one selling out must not empty the other. The
     decrement is a guarded findOneAndUpdate rather than a read-modify-write,
     so two customers buying the last unit at the same moment cannot both win. */
  const StoreInventory = require("../../../models/StoreInventory");
  for (const item of rawItems) {
    const p = productMap[item.product];

    if (fulfillingStore) {
      const row = await StoreInventory.findOneAndUpdate(
        { store: fulfillingStore, product: p._id, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (row) {
        await InventoryLog.create({
          partner: partnerId, product: p._id, type: "sale",
          quantity: -item.quantity, stockAfter: row.stock, reference: order.orderNumber,
        });
        continue;
      }
      // Shelf row missing or already emptied by a parallel order. Fall through
      // to the catalogue count rather than silently shipping nothing — the
      // order is placed and paid, and an operator can reconcile.
      console.error(`[ORDER] ${order.orderNumber}: store shelf short for ${p._id}, using catalogue stock`);
    }

    p.stock -= item.quantity;
    await p.save();
    await InventoryLog.create({
      partner: partnerId, product: p._id, type: "sale",
      quantity: -item.quantity, stockAfter: p.stock, reference: order.orderNumber,
    });
  }

  // ── Fire CJ forward async (non-blocking) ──────────────────────────────────
  // Only forward (which deducts CJ balance) once we have the money: COD or an
  // already-paid order. Online (razorpay/stripe) forwards after payment confirms.
  if (hasCJItems && (order.paymentStatus === "paid" || paymentMethod === "cod")) {
    setImmediate(() => _forwardCJOrder(order, productMap, rawItems));
  }

  // ── Order-confirmation (fire-and-forget) ─────────────────────────────────
  // Skip for online (Razorpay/Stripe) until payment is verified — sent from
  // verifyPayment / verifyStripeCheckout / the Stripe webhook instead.
  const skipNotifyNow = ((paymentMethod === "razorpay" || paymentMethod === "stripe") && order.paymentStatus !== "paid");
  if (!skipNotifyNow) {
    setImmediate(async () => {
      try {
        const u = await User.findById(userId).select("name phone email").lean();
        if (u) notifyOrderPlaced(order, u);
      } catch (e) { console.error("notifyOrderPlaced lookup err:", e.message); }
    });
  }

  return res.status(201).json({ success: true, order });

  // ── CJ Auto-forward (fire-and-forget, non-blocking) ──────────────────────
  } catch (err) {
    console.error("placeOrder error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to place order" });
  }
}

// Internal: forward CJ items to CJ Dropshipping after order placed
async function _forwardCJOrder(order, products, rawItems) {
  try {
    const cjItems = rawItems
      .map(item => {
        const p = products[item.product?.toString()];
        if (!p || p.source !== "cj") return null;
        // Use stored cjVid from order item, or match in cjVariants, or fallback to product default
        let cjVid = item.cjVid || null;
        if (!cjVid && Array.isArray(p.cjVariants) && p.cjVariants.length) {
          cjVid = p.cjVariants[0]?.cjVid || null;
        }
        if (!cjVid) cjVid = p.cjVariantId || null;
        if (!cjVid) return null;
        return { cj_variant_id: cjVid, quantity: item.quantity };
      })
      .filter(Boolean);

    if (!cjItems.length) return;

    const result = await cjService.createCJOrder(order, cjItems);
    if (result?.result && result?.data?.orderId) {
      await Order.updateOne(
        { _id: order._id },
        { $set: { cjOrderId: result.data.orderId, cjOrderStatus: result.data.orderStatus || "CREATED" } }
      );
      console.log(`[CJ] Order forwarded: ${order.orderNumber} → CJ ${result.data.orderId}`);
    } else {
      console.warn(`[CJ] Order forward failed for ${order.orderNumber}:`, result?.message);
    }
  } catch (err) {
    console.error(`[CJ] Auto-forward error for ${order.orderNumber}:`, err.message);
  }
}

// Forward a CJ order after payment is confirmed (online methods). Idempotent:
// skips if already forwarded. Called from verifyPayment / verifyStripeCheckout /
// the Stripe webhook so we never pay CJ before the customer pays us.
async function forwardCJForOrder(orderId) {
  try {
    const order = await Order.findById(orderId).populate("user", "name phone email");
    if (!order || order.cjOrderId) return;
    const cjItems = [];
    for (const item of (order.items || [])) {
      const p = await Product.findById(item.product).select("source cjVariants cjVariantId").lean();
      if (!p || p.source !== "cj") continue;
      let cjVid = item.cjVid || null;
      if (!cjVid && Array.isArray(p.cjVariants) && p.cjVariants.length) cjVid = p.cjVariants[0]?.cjVid || null;
      if (!cjVid) cjVid = p.cjVariantId || null;
      if (cjVid) cjItems.push({ cj_variant_id: cjVid, quantity: item.quantity });
    }
    if (!cjItems.length) return;
    const result = await cjService.createCJOrder(order, cjItems);
    if (result?.result && result?.data?.orderId) {
      await Order.updateOne({ _id: order._id }, { $set: { cjOrderId: result.data.orderId, cjOrderStatus: result.data.orderStatus || "CREATED" } });
      console.log(`[CJ] Order forwarded (post-payment): ${order.orderNumber} → CJ ${result.data.orderId}`);
    } else {
      console.warn(`[CJ] Post-payment forward failed for ${order.orderNumber}:`, result?.message);
    }
  } catch (err) {
    console.error(`[CJ] forwardCJForOrder error:`, err.message);
  }
}

// GET /user/orders
async function getMyOrders(req, res) {
  const { page = 1, limit = 20, status, platform } = req.query;
  const filter = { user: req.user.userId };
  if (status) filter.status = status;
  // The two storefronts keep separate order histories: a DDGo basket and a
  // marketplace shipment are different promises, and mixing them in one list
  // makes neither readable. Orders placed before this field existed have no
  // platform, and read as marketplace.
  if (platform === "ddgo") filter.platform = "ddgo";
  else if (platform === "damndeal") filter.platform = { $in: ["damndeal", null] };

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [orders, total] = await Promise.all([
    Order.find(filter).populate("partner", "name phone")
      .populate("store", "name code city contactPhone")
      .populate("items.product", "images")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Order.countDocuments(filter),
  ]);

  return res.json({
    success: true, orders,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// GET /user/orders/:id
async function getOrderDetail(req, res) {
  const order = await Order.findOne({ _id: req.params.id, user: req.user.userId })
    .populate("partner", "name phone")
    .populate("store", "name code city address contactPhone")
    .populate("deliveryBoy", "name phone")
    .populate("items.product", "images");

  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  return res.json({ success: true, order });
}

// PUT /user/orders/:id/cancel
async function cancelOrder(req, res) {
  const order = await Order.findOne({ _id: req.params.id, user: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  if (!["placed", "confirmed"].includes(order.status)) {
    return res.status(400).json({ success: false, message: "Order cannot be cancelled at this stage" });
  }

  const cancelWindowMs = 24 * 60 * 60 * 1000;
  const orderAgeMs = Date.now() - new Date(order.createdAt).getTime();
  if (orderAgeMs > cancelWindowMs) {
    return res.status(400).json({ success: false, message: "Order can only be cancelled within 24 hours" });
  }

  /* Put the stock back where it came from.
     A cancelled dark-store order returns to that store's shelf; crediting the
     catalogue instead would leave the store short by exactly the amount it
     never sold. */
  const StoreInventoryC = require("../../../models/StoreInventory");
  for (const item of order.items) {
    if (order.store) {
      const row = await StoreInventoryC.findOneAndUpdate(
        { store: order.store, product: item.product },
        { $inc: { stock: item.quantity } },
        { new: true }
      );
      if (row) {
        await InventoryLog.create({
          partner: order.partner, product: item.product, type: "return",
          quantity: item.quantity, stockAfter: row.stock, reference: order.orderNumber,
        });
        continue;
      }
      // No shelf row: this line was fulfilled from the catalogue (see the
      // fallback in placeOrder), so it goes back there.
    }

    const product = await Product.findById(item.product);
    if (product) {
      product.stock += item.quantity;
      await product.save();
      await InventoryLog.create({
        partner: order.partner, product: product._id, type: "return",
        quantity: item.quantity, stockAfter: product.stock, reference: order.orderNumber,
      });
    }
  }

  order.status = "cancelled";
  order.cancelReason = req.body.reason || "Cancelled by user";

  // Refund a paid order back to its source (US → Stripe card, India → wallet).
  try {
    await refundPaidOrder(order, "Cancelled by customer");
  } catch (e) {
    console.error("[CANCEL] refund failed:", e.message);
    return res.status(502).json({ success: false, message: `Could not process refund: ${e.message}. Order not cancelled.` });
  }

  await order.save();

  // Magic Club: reverse redemption (if any) + cancel clubs (best-effort)
  if (order.magicClub?.debit?.transactionId && !order.magicClub.debit.reversedAt) {
    const rev = await magicClub.reverseDebit(order.magicClub.debit.transactionId);
    if (rev.ok) { order.magicClub.debit.reversedAt = new Date(); await order.save(); }
  }
  magicClub.onOrderCancelled(order).catch(() => {});

  // WhatsApp cancellation notification (fire-and-forget)
  setImmediate(async () => {
    try {
      const u = await User.findById(order.user).select("name phone").lean();
      if (u) notifyOrderCancelled(order, u);
    } catch (e) { console.error("notifyOrderCancelled lookup err:", e.message); }
  });

  return res.json({ success: true, order });
}

module.exports = { placeOrder, getMyOrders, getOrderDetail, cancelOrder, getDeliveryEstimate, forwardCJForOrder };
