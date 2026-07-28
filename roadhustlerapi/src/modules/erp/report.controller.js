const WorkOrder = require("../../models/WorkOrder");
const Invoice = require("../../models/Invoice");
const Payment = require("../../models/Payment");
const Part = require("../../models/Part");
const Lead = require("../../models/Lead");
const Customer = require("../../models/Customer");
const Appointment = require("../../models/Appointment");
const { round2 } = require("../../utils/money");

function rangeFromQuery(q) {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86400000);
  return { from, to };
}

// GET /api/erp/dashboard  — KPI summary
async function dashboard(_req, res) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    revToday, revMonth, openOrders, unpaid, completedMonth,
    lowStock, newLeads, apptToday,
  ] = await Promise.all([
    Payment.aggregate([{ $match: { createdAt: { $gte: startOfDay } } }, { $group: { _id: null, sum: { $sum: "$amount" } } }]),
    Payment.aggregate([{ $match: { createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, sum: { $sum: "$amount" } } }]),
    WorkOrder.countDocuments({ status: { $in: ["estimate", "approved", "in_progress", "on_hold"] } }),
    Invoice.aggregate([{ $match: { status: { $in: ["sent", "partial", "overdue"] } } }, { $group: { _id: null, sum: { $sum: "$amountDue" }, count: { $sum: 1 } } }]),
    WorkOrder.countDocuments({ status: { $in: ["completed", "invoiced"] }, completedAt: { $gte: startOfMonth } }),
    Part.countDocuments({ isActive: true, $expr: { $lte: ["$quantityInStock", "$reorderLevel"] } }),
    Lead.countDocuments({ status: "new" }),
    Appointment.countDocuments({ preferredDate: { $gte: startOfDay }, status: { $in: ["requested", "confirmed"] } }),
  ]);

  // status breakdown of open work orders
  const statusAgg = await WorkOrder.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  const ordersByStatus = {};
  statusAgg.forEach((s) => { ordersByStatus[s._id] = s.count; });

  // avg ticket (this month)
  const invMonth = await Invoice.aggregate([{ $match: { createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, sum: { $sum: "$total" }, count: { $sum: 1 } } }]);
  const avgTicket = invMonth[0]?.count ? round2(invMonth[0].sum / invMonth[0].count) : 0;

  res.json({
    success: true,
    data: {
      revenueToday: round2(revToday[0]?.sum || 0),
      revenueMonth: round2(revMonth[0]?.sum || 0),
      openWorkOrders: openOrders,
      ordersByStatus,
      outstandingAmount: round2(unpaid[0]?.sum || 0),
      outstandingInvoices: unpaid[0]?.count || 0,
      jobsCompletedMonth: completedMonth,
      avgTicket,
      lowStockCount: lowStock,
      newLeads,
      appointmentsToday: apptToday,
    },
  });
}

// GET /api/erp/reports/revenue?from=&to=&groupBy=day|week|month
async function revenue(req, res) {
  const { from, to } = rangeFromQuery(req.query);
  const groupBy = req.query.groupBy || "day";
  const fmt = groupBy === "month" ? "%Y-%m" : groupBy === "week" ? "%Y-%U" : "%Y-%m-%d";
  const series = await Payment.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: { $dateToString: { format: fmt, date: "$createdAt" } }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const total = series.reduce((s, x) => s + x.total, 0);
  res.json({ success: true, data: { from, to, groupBy, total: round2(total), series } });
}

// GET /api/erp/reports/inventory  — valuation + low stock
async function inventory(_req, res) {
  const agg = await Part.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: null, costValue: { $sum: { $multiply: ["$quantityInStock", "$costPrice"] } }, retailValue: { $sum: { $multiply: ["$quantityInStock", "$sellPrice"] } }, items: { $sum: 1 }, units: { $sum: "$quantityInStock" } } },
  ]);
  const low = await Part.find({ isActive: true, $expr: { $lte: ["$quantityInStock", "$reorderLevel"] } }).select("name partNumber quantityInStock reorderLevel").lean();
  const v = agg[0] || {};
  res.json({ success: true, data: { costValue: round2(v.costValue || 0), retailValue: round2(v.retailValue || 0), distinctItems: v.items || 0, totalUnits: v.units || 0, lowStock: low } });
}

// GET /api/erp/reports/technicians — productivity
async function technicians(req, res) {
  const { from, to } = rangeFromQuery(req.query);
  const orders = await WorkOrder.find({ createdAt: { $gte: from, $lte: to } }).select("timeLog laborItems status assignedTechs").populate("assignedTechs", "name");
  const map = {};
  orders.forEach((wo) => {
    wo.timeLog.forEach((t) => {
      const id = String(t.tech);
      map[id] = map[id] || { minutes: 0, billableHours: 0, jobs: 0, name: "" };
      map[id].minutes += t.minutes || 0;
    });
    wo.laborItems.forEach((l) => {
      if (!l.tech) return;
      const id = String(l.tech);
      map[id] = map[id] || { minutes: 0, billableHours: 0, jobs: 0, name: "" };
      map[id].billableHours += l.hours || 0;
    });
    (wo.assignedTechs || []).forEach((t) => {
      const id = String(t._id);
      map[id] = map[id] || { minutes: 0, billableHours: 0, jobs: 0, name: "" };
      map[id].name = t.name;
      map[id].jobs += 1;
    });
  });
  const rows = Object.entries(map).map(([id, v]) => ({ techId: id, name: v.name, clockedHours: round2(v.minutes / 60), billableHours: round2(v.billableHours), jobs: v.jobs }));
  res.json({ success: true, data: { from, to, technicians: rows } });
}

// GET /api/erp/reports/leads — funnel + conversion
async function leads(_req, res) {
  const agg = await Lead.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  const byStatus = {}; agg.forEach((a) => { byStatus[a._id] = a.count; });
  const total = Object.values(byStatus).reduce((s, n) => s + n, 0);
  const converted = byStatus.converted || 0;
  res.json({ success: true, data: { byStatus, total, conversionRate: total ? round2((converted / total) * 100) : 0 } });
}

// GET /api/erp/reports/customers — top spenders
async function customers(_req, res) {
  const top = await Customer.find({}).sort({ totalSpent: -1 }).limit(20).select("name phone totalSpent").lean();
  res.json({ success: true, data: { topSpenders: top } });
}

// GET /api/erp/reports/sales-tax?from=&to=  — tax collected
async function salesTax(req, res) {
  const { from, to } = rangeFromQuery(req.query);
  const agg = await Invoice.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to }, status: { $ne: "void" } } },
    { $group: { _id: null, taxCollected: { $sum: "$taxAmount" }, taxableSales: { $sum: "$subtotal" }, invoices: { $sum: 1 } } },
  ]);
  const v = agg[0] || {};
  res.json({ success: true, data: { from, to, taxCollected: round2(v.taxCollected || 0), taxableSales: round2(v.taxableSales || 0), invoices: v.invoices || 0 } });
}

module.exports = { dashboard, revenue, inventory, technicians, leads, customers, salesTax };
