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
const crypto = require("crypto");

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DD-${ts}-${rand}`;
}

async function _calculateCJDeliverySummary(rawItems, productMap) {
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

  if (!cjLines.length) return { feeInr: 0, minDays: null, maxDays: null };

  const usdRate = parseFloat(await getSetting("cj_usd_inr_rate", 84)) || 84;

  let totalUsd = 0;
  let minDays = null;
  let maxDays = null;

  for (const line of cjLines) {
    try {
      const estimate = await cjService.estimateFreightSummary({
        startCountryCode: "CN",
        endCountryCode: "IN",
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

  if (kyc && kyc.location && kyc.location.coordinates) {
    const [shopLng, shopLat] = kyc.location.coordinates;
    distanceKm = calcDistanceKm(address.lat, address.lng, shopLat, shopLng);
    freeDeliveryAbove = kyc.freeDeliveryAbove || 0;
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
  });

  if (fees.error) {
    return res.status(400).json({ success: false, message: fees.error });
  }

  if (!freeDeliveryAbove) {
    freeDeliveryAbove = await getSetting("free_delivery_above", 0);
  }

  return res.json({
    success: true,
    estimate: {
      ...fees,
      freeDeliveryAbove,
      shopName: kyc?.organizationName || "DamnDeal",
    },
  });
}

// POST /user/orders — place order from app
async function placeOrder(req, res) {
  try {
  const userId = req.user.userId;
  const { partnerId, items: rawItems, addressId, paymentMethod, note, platform = "damndeal" } = req.body;
  // SECURITY: never trust client-sent discount/price. No coupon system yet → force 0.
  // When coupons are added, validate code server-side and recompute discount here.
  const discount = 0;

  if (!partnerId || !rawItems?.length || !addressId) {
    return res.status(400).json({ success: false, message: "partnerId, items, addressId required" });
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
    });
  }

  if (fees.error) {
    return res.status(400).json({ success: false, message: fees.error });
  }

  const { deliveryFee, freeDeliveryApplied, platformFee, codFee, estimatedDeliveryMinutes, minOrderAmount } = fees;

  // Minimum order check (uses platform-specific setting from calculateFees)
  if (minOrderAmount > 0 && subtotal - discount < minOrderAmount) {
    return res.status(400).json({ success: false, message: `Minimum order amount is ₹${minOrderAmount}` });
  }

  const hasCJItems = products.some((p) => p.source === "cj");
  let cjDelivery = { feeInr: 0, minDays: null, maxDays: null };
  if (hasCJItems) {
    cjDelivery = await _calculateCJDeliverySummary(rawItems, productMap);
  }

  const finalDeliveryFee = Math.round((deliveryFee + (cjDelivery.feeInr || 0)) * 100) / 100;

  // Grand total = subtotal - discount + deliveryFee + platformFee + codFee
  const grandTotal = Math.round((subtotal - discount + finalDeliveryFee + platformFee + (codFee || 0)) * 100) / 100;
  const profit = Math.round((subtotal - discount - costTotal) * 100) / 100;

  let finalEstimatedDeliveryMinutes = estimatedDeliveryMinutes;
  if (hasCJItems && cjDelivery.maxDays != null) {
    finalEstimatedDeliveryMinutes = parseInt(cjDelivery.maxDays, 10) * 24 * 60;
  }

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    user: userId, partner: partnerId,
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
    paymentStatus: (paymentMethod === "cod" || paymentMethod === "razorpay") ? "pending" : "paid",
    status: "placed", source: "app",
    note: note || "",
  });

  // Deduct stock
  for (const item of rawItems) {
    const p = productMap[item.product];
    p.stock -= item.quantity;
    await p.save();
    await InventoryLog.create({
      partner: partnerId, product: p._id, type: "sale",
      quantity: -item.quantity, stockAfter: p.stock, reference: order.orderNumber,
    });
  }

  // ── Fire CJ forward async (non-blocking) ──────────────────────────────────
  if (hasCJItems) {
    setImmediate(() => _forwardCJOrder(order, productMap, rawItems));
  }

  // ── WhatsApp order-confirmation (fire-and-forget) ────────────────────────
  // Skip for online (Razorpay) until payment is verified — handled in verifyPayment.
  const skipNotifyNow = (paymentMethod === "razorpay" && order.paymentStatus !== "paid");
  if (!skipNotifyNow) {
    setImmediate(async () => {
      try {
        const u = await User.findById(userId).select("name phone").lean();
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

// GET /user/orders
async function getMyOrders(req, res) {
  const { page = 1, limit = 20, status } = req.query;
  const filter = { user: req.user.userId };
  if (status) filter.status = status;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [orders, total] = await Promise.all([
    Order.find(filter).populate("partner", "name phone")
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

  // Restore stock
  for (const item of order.items) {
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
  await order.save();

  // WhatsApp cancellation notification (fire-and-forget)
  setImmediate(async () => {
    try {
      const u = await User.findById(order.user).select("name phone").lean();
      if (u) notifyOrderCancelled(order, u);
    } catch (e) { console.error("notifyOrderCancelled lookup err:", e.message); }
  });

  return res.json({ success: true, order });
}

module.exports = { placeOrder, getMyOrders, getOrderDetail, cancelOrder, getDeliveryEstimate };
