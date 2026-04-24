const ReturnRequest = require("../../../models/ReturnRequest");
const Order = require("../../../models/Order");

// GET /partner/returns — list return requests for my orders
async function listReturns(req, res) {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = { partner: req.user.userId };
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [returns, total] = await Promise.all([
    ReturnRequest.find(filter)
      .populate("order", "orderNumber grandTotal")
      .populate("user", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    ReturnRequest.countDocuments(filter),
  ]);

  return res.json({ success: true, returns, total, page: Number(page), pages: Math.ceil(total / limit) });
}

// GET /partner/returns/:id
async function getReturn(req, res) {
  const ret = await ReturnRequest.findOne({ _id: req.params.id, partner: req.user.userId })
    .populate("order")
    .populate("user", "name phone")
    .lean();

  if (!ret) return res.status(404).json({ success: false, message: "Return not found" });
  return res.json({ success: true, return: ret });
}

module.exports = { listReturns, getReturn };
