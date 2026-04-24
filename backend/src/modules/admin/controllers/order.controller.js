const Order = require("../../../models/Order");
const Product = require("../../../models/Product");
const User = require("../../../models/User");
const InventoryLog = require("../../../models/InventoryLog");
const { notifyOrderShipped, notifyOrderCancelled } = require("../../../services/notification.service");

async function restoreOrderStock(order) {
  for (const item of order.items || []) {
    const product = await Product.findById(item.product);
    if (!product) continue;
    product.stock += item.quantity;
    await product.save();
    await InventoryLog.create({
      partner: order.partner,
      product: product._id,
      type: "return",
      quantity: item.quantity,
      stockAfter: product.stock,
      reference: order.orderNumber,
    });
  }
}

// GET /admin/orders
async function listOrders(req, res) {
  const { page = 1, limit = 20, status, partner, from, to, source, tab = "all" } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (partner) filter.partner = partner;
  if (source) filter.source = source;

  // Quick tabs for admin workflow
  if (!status && tab && tab !== "all") {
    if (tab === "active") {
      filter.status = "placed";
    } else if (tab === "accepted") {
      filter.status = { $in: ["confirmed", "processing", "ready", "shipped", "delivered", "returned"] };
    } else if (tab === "rejected") {
      filter.status = "cancelled";
      filter.rejectedReason = { $exists: true, $ne: null };
    }
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("partner", "name phone")
      .populate("user", "name phone")
      .populate("deliveryBoy", "name phone")
      .populate("items.product", "images")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Order.countDocuments(filter),
  ]);

  return res.json({
    success: true, orders,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// GET /admin/orders/:id
async function getOrder(req, res) {
  const order = await Order.findById(req.params.id)
    .populate("partner", "name phone")
    .populate("user", "name phone")
    .populate("deliveryBoy", "name phone")
    .populate("customer", "name phone")
    .populate("items.product", "images sku");

  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  return res.json({ success: true, order });
}

// PUT /admin/orders/:id/assign-delivery
async function assignDeliveryBoy(req, res) {
  const { deliveryBoyId } = req.body;
  if (!deliveryBoyId) return res.status(400).json({ success: false, message: "deliveryBoyId required" });

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  const crypto = require("crypto");
  order.deliveryBoy = deliveryBoyId;
  order.deliveryStatus = "assigned";
  order.deliveryOtp = crypto.randomInt(1000, 9999).toString();
  await order.save();

  return res.json({ success: true, order });
}

// PUT /admin/orders/:id/status — update order status
async function updateOrderStatus(req, res) {
  try {
    const { status, note } = req.body;
    const validStatuses = ["placed", "confirmed", "processing", "ready", "shipped", "delivered", "cancelled", "returned"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const previousStatus = order.status;
    order.status = status;
    if (status === "confirmed") order.acceptedAt = new Date();
    if (status === "delivered") order.deliveredAt = new Date();
    if (status === "cancelled") {
      if (previousStatus !== "cancelled") {
        await restoreOrderStock(order);
      }
      order.cancelReason = note || order.cancelReason || "Cancelled by admin";
    }
    await order.save();

    return res.json({ success: true, order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /admin/orders/:id/reject — reject order with note (stored as cancelled)
async function rejectOrder(req, res) {
  try {
    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: "Rejection note is required" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (["delivered", "returned", "cancelled"].includes(order.status)) {
      return res.status(400).json({ success: false, message: "Order cannot be rejected at this stage" });
    }

    await restoreOrderStock(order);
    order.status = "cancelled";
    order.rejectedAt = new Date();
    order.rejectedReason = String(reason).trim();
    order.cancelReason = `Rejected by admin: ${String(reason).trim()}`;
    await order.save();

    setImmediate(async () => {
      try {
        const u = await User.findById(order.user).select("name phone").lean();
        if (u) notifyOrderCancelled(order, u);
      } catch (e) { console.error("notifyOrderCancelled (reject) err:", e.message); }
    });

    return res.json({ success: true, order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /admin/orders/:id/self-ship — manual courier entry
async function selfShip(req, res) {
  try {
    const { courierName, trackingId, trackingUrl } = req.body;
    if (!courierName || !trackingId) {
      return res.status(400).json({ success: false, message: "courierName and trackingId required" });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    order.shipping = {
      ...(order.shipping || {}),
      provider: null,
      courierName,
      awb: trackingId,
      trackingUrl: trackingUrl || null,
      shippedAt: new Date(),
      status: "shipped",
      events: [{ status: "Shipped", description: `Shipped via ${courierName}`, timestamp: new Date(), location: "" }],
    };
    order.status = "shipped";
    order.fulfillmentType = "self";
    await order.save();

    setImmediate(async () => {
      try {
        const u = await User.findById(order.user).select("name phone").lean();
        if (u) notifyOrderShipped(order, u, { courierName, trackingId });
      } catch (e) { console.error("notifyOrderShipped (selfShip) err:", e.message); }
    });

    return res.json({ success: true, message: "Order marked as self-shipped", order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /admin/orders/:id/self-ship-update — add tracking event for self-shipped orders
async function selfShipUpdate(req, res) {
  try {
    const { status, description, location } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "status required" });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (!order.shipping) order.shipping = {};
    if (!order.shipping.events) order.shipping.events = [];
    order.shipping.events.push({ status, description: description || "", location: location || "", timestamp: new Date() });
    order.shipping.status = status;

    // Auto-update order status based on tracking
    const statusMap = { "Dispatched": "shipped", "Out for Delivery": "out_for_delivery", "Delivered": "delivered" };
    if (statusMap[status]) {
      order.status = statusMap[status];
      if (status === "Delivered") order.deliveredAt = new Date();
    }
    order.markModified("shipping");
    await order.save();

    return res.json({ success: true, order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { listOrders, getOrder, assignDeliveryBoy, updateOrderStatus, rejectOrder, selfShip, selfShipUpdate };
