const Order = require("../../../models/Order");
const DeliveryBoy = require("../../../models/DeliveryBoy");
const Product = require("../../../models/Product");

// GET /delivery/assignments — orders assigned to this delivery boy
async function getAssignments(req, res) {
  const { page = 1, limit = 20, status } = req.query;
  const filter = { deliveryBoy: req.user.userId };
  if (status) filter.deliveryStatus = status;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [orders, total] = await Promise.all([
    Order.find(filter).populate("partner", "name phone")
      .populate("user", "name phone")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Order.countDocuments(filter),
  ]);

  return res.json({
    success: true, orders,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// GET /delivery/assignments/:id
async function getAssignment(req, res) {
  const order = await Order.findOne({ _id: req.params.id, deliveryBoy: req.user.userId })
    .populate("partner", "name phone")
    .populate("user", "name phone")
    .populate("items.product", "images");

  if (!order) return res.status(404).json({ success: false, message: "Assignment not found" });
  return res.json({ success: true, order });
}

// PUT /delivery/assignments/:id/pickup — mark as picked up
async function markPickedUp(req, res) {
  const order = await Order.findOne({ _id: req.params.id, deliveryBoy: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Assignment not found" });

  if (order.deliveryStatus !== "assigned") {
    return res.status(400).json({ success: false, message: "Order not in assigned state" });
  }

  order.deliveryStatus = "picked_up";
  order.status = "shipped";
  await order.save();

  return res.json({ success: true, order });
}

// PUT /delivery/assignments/:id/on-the-way
async function markOnTheWay(req, res) {
  const order = await Order.findOne({ _id: req.params.id, deliveryBoy: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Assignment not found" });

  order.deliveryStatus = "on_the_way";
  await order.save();

  return res.json({ success: true, order });
}

// PUT /delivery/assignments/:id/deliver — verify OTP and complete
async function markDelivered(req, res) {
  const { otp } = req.body;
  const order = await Order.findOne({ _id: req.params.id, deliveryBoy: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Assignment not found" });

  if (order.deliveryOtp && order.deliveryOtp !== otp) {
    return res.status(400).json({ success: false, message: "Invalid delivery OTP" });
  }

  order.deliveryStatus = "delivered";
  order.status = "delivered";
  order.deliveredAt = new Date();
  order.paymentStatus = "paid";
  await order.save();

  // Magic Club: create reward club (best-effort, never blocks)
  require("../../../services/magicclub.service").onOrderDelivered(order).catch(() => {});

  // Update delivery boy stats
  const boy = await DeliveryBoy.findOne({ user: req.user.userId });
  if (boy) {
    boy.totalDeliveries += 1;
    // TODO: calculate delivery earnings based on settings
    boy.totalEarnings += 20; // placeholder
    await boy.save();
  }

  return res.json({ success: true, order });
}

// PUT /delivery/assignments/:id/fail
async function markFailed(req, res) {
  const { reason } = req.body;
  const order = await Order.findOne({ _id: req.params.id, deliveryBoy: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Assignment not found" });

  order.deliveryStatus = "failed";
  order.note = reason || "Delivery failed";
  await order.save();

  return res.json({ success: true, order });
}

module.exports = { getAssignments, getAssignment, markPickedUp, markOnTheWay, markDelivered, markFailed };
