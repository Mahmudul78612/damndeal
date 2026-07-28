const Order = require("../../../models/Order");
const Product = require("../../../models/Product");
const Customer = require("../../../models/Customer");
const InventoryLog = require("../../../models/InventoryLog");
const DeliveryBoy = require("../../../models/DeliveryBoy");
const magicClub = require("../../../services/magicclub.service");

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DD-${ts}-${rand}`;
}

// POST /partner/orders — POS order (partner sells in-store)
async function createOrder(req, res) {
  const partnerId = req.user.userId;
  const { items: rawItems, discount = 0, paymentMethod, note, customer: custInput } = req.body;

  const productIds = rawItems.map((i) => i.product);
  const products = await Product.find({ _id: { $in: productIds }, partner: partnerId, isActive: true });
  if (products.length !== rawItems.length) {
    return res.status(400).json({ success: false, message: "One or more products not found" });
  }

  const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));
  let subtotal = 0, totalGst = 0, costTotal = 0;
  const orderItems = [];

  for (const item of rawItems) {
    const p = productMap[item.product];
    if (p.stock < item.quantity) {
      return res.status(400).json({ success: false, message: `Insufficient stock for "${p.name}" (${p.stock} left)` });
    }

    let gstAmount;
    if (p.gstInclusive) {
      const priceExGst = p.sellingPrice / (1 + p.gstPercent / 100);
      gstAmount = (p.sellingPrice - priceExGst) * item.quantity;
    } else {
      gstAmount = (p.sellingPrice * p.gstPercent / 100) * item.quantity;
    }

    const lineTotal = p.sellingPrice * item.quantity;
    subtotal += lineTotal;
    totalGst += gstAmount;
    costTotal += p.costPrice * item.quantity;

    orderItems.push({
      product: p._id, name: p.name, quantity: item.quantity, unit: p.unit,
      price: p.sellingPrice, gstPercent: p.gstPercent,
      gstAmount: Math.round(gstAmount * 100) / 100,
      total: Math.round(lineTotal * 100) / 100,
    });
  }

  const grandTotal = Math.round((subtotal - discount) * 100) / 100;
  const profit = Math.round((grandTotal - costTotal) * 100) / 100;

  let customerId = null;
  if (custInput && custInput.phone) {
    let customer = await Customer.findOne({ partner: partnerId, phone: custInput.phone });
    if (!customer) customer = await Customer.create({ partner: partnerId, ...custInput });
    customerId = customer._id;
  }

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    partner: partnerId, customer: customerId, items: orderItems,
    subtotal: Math.round(subtotal * 100) / 100,
    totalGst: Math.round(totalGst * 100) / 100,
    discount, grandTotal, costTotal: Math.round(costTotal * 100) / 100, profit,
    paymentMethod, note, status: "confirmed", paymentStatus: "paid", source: "pos",
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

  if (customerId) {
    await Customer.findByIdAndUpdate(customerId, {
      $inc: { totalOrders: 1, totalSpent: grandTotal }, lastOrderAt: new Date(),
    });
  }

  return res.status(201).json({ success: true, order });
}

// GET /partner/orders
async function getOrders(req, res) {
  const { page = 1, limit = 20, status, from, to } = req.query;
  const filter = { partner: req.user.userId };
  if (status) filter.status = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [orders, total] = await Promise.all([
    Order.find(filter).populate("customer", "name phone").populate("user", "name phone")
      .populate("deliveryBoy", "name phone")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Order.countDocuments(filter),
  ]);

  return res.json({
    success: true, orders,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// GET /partner/orders/:id
async function getOrder(req, res) {
  const order = await Order.findOne({ _id: req.params.id, partner: req.user.userId })
    .populate("customer", "name phone email").populate("user", "name phone")
    .populate("deliveryBoy", "name phone").populate("items.product", "images sku");
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  return res.json({ success: true, order });
}

// PUT /partner/orders/:id/status
async function updateOrderStatus(req, res) {
  const { status } = req.body;
  const order = await Order.findOne({ _id: req.params.id, partner: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  // Restore stock on cancellation
  if (status === "cancelled" && order.status !== "cancelled") {
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
        await InventoryLog.create({
          partner: req.user.userId, product: product._id, type: "return",
          quantity: item.quantity, stockAfter: product.stock, reference: order.orderNumber,
        });
      }
    }
  }

  order.status = status;
  if (status === "cancelled") order.cancelReason = req.body.reason || null;
  await order.save();

  return res.json({ success: true, order });
}

// PUT /partner/orders/:id/accept — partner accepts incoming app order
async function acceptOrder(req, res) {
  const order = await Order.findOne({ _id: req.params.id, partner: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  if (order.status !== "placed") {
    return res.status(400).json({ success: false, message: "Only placed orders can be accepted" });
  }

  order.status = "confirmed";
  order.acceptedAt = new Date();
  await order.save();

  return res.json({ success: true, order });
}

// PUT /partner/orders/:id/reject — partner rejects incoming app order
async function rejectOrder(req, res) {
  const { reason } = req.body;
  const order = await Order.findOne({ _id: req.params.id, partner: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  if (order.status !== "placed") {
    return res.status(400).json({ success: false, message: "Only placed orders can be rejected" });
  }

  // Restore stock
  for (const item of order.items) {
    const product = await Product.findById(item.product);
    if (product) {
      product.stock += item.quantity;
      await product.save();
      await InventoryLog.create({
        partner: req.user.userId, product: product._id, type: "return",
        quantity: item.quantity, stockAfter: product.stock, reference: order.orderNumber,
      });
    }
  }

  order.status = "cancelled";
  order.rejectedAt = new Date();
  order.rejectedReason = reason || "Rejected by partner";
  order.cancelReason = reason || "Rejected by partner";
  await order.save();

  // Magic Club: reverse redemption + cancel clubs (best-effort)
  if (order.magicClub?.debit?.transactionId && !order.magicClub.debit.reversedAt) {
    const rev = await magicClub.reverseDebit(order.magicClub.debit.transactionId);
    if (rev.ok) { order.magicClub.debit.reversedAt = new Date(); await order.save(); }
  }
  magicClub.onOrderCancelled(order).catch(() => {});

  return res.json({ success: true, order });
}

// PUT /partner/orders/:id/ready — partner marks order ready for pickup
async function markReady(req, res) {
  const order = await Order.findOne({ _id: req.params.id, partner: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  if (!["confirmed", "processing"].includes(order.status)) {
    return res.status(400).json({ success: false, message: "Order must be confirmed or processing" });
  }

  order.status = "ready";
  await order.save();

  return res.json({ success: true, order });
}

// PUT /partner/orders/:id/assign-delivery — partner assigns own delivery boy
async function assignDeliveryBoy(req, res) {
  const { deliveryBoyId } = req.body;
  if (!deliveryBoyId) {
    return res.status(400).json({ success: false, message: "deliveryBoyId required" });
  }

  const order = await Order.findOne({ _id: req.params.id, partner: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  // Ensure delivery boy belongs to this partner
  const boy = await DeliveryBoy.findOne({ _id: deliveryBoyId, partner: req.user.userId });
  if (!boy) {
    return res.status(404).json({ success: false, message: "Delivery boy not found or not your delivery boy" });
  }

  const crypto = require("crypto");
  order.deliveryBoy = boy._id;
  order.fulfillmentType = "self";
  order.deliveryStatus = "assigned";
  order.deliveryOtp = crypto.randomInt(1000, 9999).toString();
  if (order.status === "placed") order.status = "confirmed";
  await order.save();

  return res.json({ success: true, order });
}

// PUT /partner/orders/:id/delivery-status — partner updates delivery status for self-ship
async function updateDeliveryStatus(req, res) {
  const { deliveryStatus } = req.body;
  const allowed = ["picked_up", "on_the_way"];
  if (!allowed.includes(deliveryStatus)) {
    return res.status(400).json({ success: false, message: `deliveryStatus must be one of: ${allowed.join(", ")}` });
  }

  const order = await Order.findOne({ _id: req.params.id, partner: req.user.userId, fulfillmentType: "self" });
  if (!order) return res.status(404).json({ success: false, message: "Self-ship order not found" });

  order.deliveryStatus = deliveryStatus;
  if (deliveryStatus === "picked_up") order.status = "shipped";
  await order.save();

  return res.json({ success: true, order });
}

// PUT /partner/orders/:id/mark-delivered — partner marks self-ship order as delivered
async function markSelfDelivered(req, res) {
  const { otp } = req.body;
  const order = await Order.findOne({ _id: req.params.id, partner: req.user.userId, fulfillmentType: "self" });
  if (!order) return res.status(404).json({ success: false, message: "Self-ship order not found" });

  if (order.deliveryOtp && order.deliveryOtp !== otp) {
    return res.status(400).json({ success: false, message: "Invalid delivery OTP" });
  }

  order.deliveryStatus = "delivered";
  order.status = "delivered";
  order.deliveredAt = new Date();
  order.paymentStatus = "paid";
  await order.save();

  // Update delivery boy stats if assigned
  if (order.deliveryBoy) {
    await DeliveryBoy.findByIdAndUpdate(order.deliveryBoy, {
      $inc: { totalDeliveries: 1, totalEarnings: 20 },
    });
  }

  // Magic Club: create reward club (best-effort, never blocks)
  magicClub.onOrderDelivered(order).catch(() => {});

  return res.json({ success: true, order });
}

module.exports = { createOrder, getOrders, getOrder, updateOrderStatus, acceptOrder, rejectOrder, markReady, assignDeliveryBoy, updateDeliveryStatus, markSelfDelivered };
