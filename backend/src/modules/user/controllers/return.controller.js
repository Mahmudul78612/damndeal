const ReturnRequest = require("../../../models/ReturnRequest");
const Order = require("../../../models/Order");

const RETURN_WINDOW_DAYS = 7;

const REASON_MAP = {
  defective: "Item arrived defective / damaged",
  wrong_item: "Wrong item delivered",
  not_as_described: "Item not as described",
  size_issue: "Size / fit issue",
  quality_issue: "Quality not as expected",
  changed_mind: "Changed my mind",
  other: "Other",
};

// POST /user/returns — create return request
async function createReturn(req, res) {
  const { orderId, reason, note, items } = req.body;
  if (!orderId || !reason) {
    return res.status(400).json({ success: false, message: "orderId and reason required" });
  }
  if (!REASON_MAP[reason]) {
    return res.status(400).json({ success: false, message: "Invalid reason selected" });
  }

  const order = await Order.findOne({ _id: orderId, user: req.user.userId });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  if (order.status !== "delivered") {
    return res.status(400).json({ success: false, message: "Only delivered orders can be returned" });
  }

  // 7-day return window
  const deliveredAt = order.deliveredAt || order.updatedAt;
  if (deliveredAt) {
    const ageDays = (Date.now() - new Date(deliveredAt).getTime()) / 86400000;
    if (ageDays > RETURN_WINDOW_DAYS) {
      return res.status(400).json({
        success: false,
        message: `Return window of ${RETURN_WINDOW_DAYS} days has expired`,
      });
    }
  }

  // Existing active return for this order?
  const existing = await ReturnRequest.findOne({ order: orderId, status: { $ne: "rejected" } });
  if (existing) {
    return res.status(409).json({ success: false, message: "Return request already exists for this order" });
  }

  // Calculate refund — if specific items provided, use those; else full order
  const returnItems = [];
  let totalRefund = 0;

  if (Array.isArray(items) && items.length > 0) {
    for (const ri of items) {
      const orderItem = order.items.find((oi) => oi.product.toString() === ri.product);
      if (!orderItem) continue;
      const qty = Math.min(Math.max(parseInt(ri.quantity, 10) || 1, 1), orderItem.quantity);
      const refund = orderItem.price * qty;
      returnItems.push({
        product: orderItem.product,
        name: orderItem.name,
        quantity: qty,
        refundAmount: Math.round(refund * 100) / 100,
      });
      totalRefund += refund;
    }
  } else {
    for (const oi of order.items) {
      returnItems.push({
        product: oi.product,
        name: oi.name,
        quantity: oi.quantity,
        refundAmount: oi.total,
      });
      totalRefund += oi.total;
    }
  }

  if (returnItems.length === 0) {
    return res.status(400).json({ success: false, message: "No valid items to return" });
  }

  totalRefund = Math.round(totalRefund * 100) / 100;

  const reasonLabel = REASON_MAP[reason];
  const fullReason = note && String(note).trim()
    ? `${reasonLabel} - ${String(note).trim().slice(0, 300)}`
    : reasonLabel;

  const ret = await ReturnRequest.create({
    order: orderId,
    user: req.user.userId,
    partner: order.partner,
    reason: fullReason,
    items: returnItems,
    totalRefundAmount: totalRefund,
    refundTo: "wallet",
  });

  return res.status(201).json({ success: true, returnRequest: ret });
}

// GET /user/returns
async function getMyReturns(req, res) {
  const returns = await ReturnRequest.find({ user: req.user.userId })
    .populate("order", "orderNumber grandTotal")
    .sort({ createdAt: -1 });

  return res.json({ success: true, returns });
}

// GET /user/returns/order/:orderId — fetch latest return for an order
async function getReturnByOrder(req, res) {
  const ret = await ReturnRequest.findOne({
    order: req.params.orderId,
    user: req.user.userId,
  }).sort({ createdAt: -1 });
  return res.json({ success: true, returnRequest: ret });
}

module.exports = { createReturn, getMyReturns, getReturnByOrder };
