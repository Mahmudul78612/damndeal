const PurchaseOrder = require("../../models/PurchaseOrder");
const Part = require("../../models/Part");
const Settings = require("../../models/Settings");
const { nextSeq, formatNumber } = require("../../models/Counter");
const { round2, sum } = require("../../utils/money");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

function computeTotals(po) {
  po.items.forEach((it) => { it.lineTotal = round2(Number(it.quantity || 0) * Number(it.costPrice || 0)); });
  po.subtotal = sum(po.items, (i) => i.lineTotal);
  po.total = round2(po.subtotal + Number(po.tax || 0) + Number(po.shipping || 0));
}

// GET /api/erp/purchase-orders?status=&supplier=
async function list(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.supplier) filter.supplier = req.query.supplier;
  const result = await paginate(PurchaseOrder, filter, { ...req.query, populate: { path: "supplier", select: "name" } });
  res.json({ success: true, ...result });
}

// POST /api/erp/purchase-orders
async function create(req, res) {
  if (!req.body.supplier) throw new ApiError(400, "supplier is required");
  const s = await Settings.get();
  const seq = await nextSeq("purchaseOrder", s.poStartNumber || 1001);
  const po = new PurchaseOrder({
    ...req.body,
    poNumber: formatNumber(s.poPrefix, seq),
    createdBy: req.auth.id,
  });
  computeTotals(po);
  await po.save();
  res.status(201).json({ success: true, data: po });
}

async function getOne(req, res) {
  const po = await PurchaseOrder.findById(req.params.id).populate("supplier").populate("items.part", "name partNumber");
  if (!po) throw new ApiError(404, "Purchase order not found");
  res.json({ success: true, data: po });
}

// PATCH /api/erp/purchase-orders/:id  (edit lines / set status=ordered)
async function update(req, res) {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, "Purchase order not found");
  if (po.status === "received") throw new ApiError(409, "Received POs cannot be edited");
  Object.assign(po, req.body);
  if (req.body.status === "ordered" && !po.orderedAt) po.orderedAt = new Date();
  computeTotals(po);
  await po.save();
  res.json({ success: true, data: po });
}

// POST /api/erp/purchase-orders/:id/receive  → increments part stock
async function receive(req, res) {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) throw new ApiError(404, "Purchase order not found");
  if (po.status === "received") throw new ApiError(409, "Already received");

  // received quantities: body.received = { partId: qty } OR default to ordered qty
  for (const item of po.items) {
    if (!item.part) continue;
    const recv = req.body.received?.[String(item.part)] ?? item.quantity;
    item.receivedQty = Number(recv) || 0;
    if (item.receivedQty > 0) {
      await Part.findByIdAndUpdate(item.part, { $inc: { quantityInStock: item.receivedQty } });
    }
  }
  po.status = "received";
  po.receivedAt = new Date();
  await po.save();
  res.json({ success: true, data: po, message: "Stock received" });
}

module.exports = { list, create, getOne, update, receive };
