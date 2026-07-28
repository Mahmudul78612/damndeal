const Invoice = require("../../models/Invoice");
const WorkOrder = require("../../models/WorkOrder");
const Part = require("../../models/Part");
const Settings = require("../../models/Settings");
const { nextSeq, formatNumber } = require("../../models/Counter");
const { recalcWorkOrder } = require("../../utils/calcWorkOrder");
const { round2 } = require("../../utils/money");
const { paginate } = require("../../utils/paginate");
const { notify } = require("../../utils/notify");
const { ApiError } = require("../../middleware/error.middleware");
const emailSvc = require("../../services/email.service");

// Build invoice line snapshot from a work order
function snapshotLines(wo) {
  const lines = [];
  wo.laborItems.forEach((l) =>
    lines.push({ kind: "labor", description: l.description, quantity: l.hours || 1, unitPrice: l.hours ? l.rate : l.lineTotal, taxable: l.taxable, lineTotal: l.lineTotal })
  );
  wo.partItems.forEach((p) =>
    lines.push({ kind: "part", description: p.description, quantity: p.quantity, unitPrice: p.sellPrice, taxable: p.taxable, lineTotal: p.lineTotal })
  );
  if (wo.shopSuppliesFee > 0)
    lines.push({ kind: "fee", description: "Shop Supplies", quantity: 1, unitPrice: wo.shopSuppliesFee, taxable: false, lineTotal: wo.shopSuppliesFee });
  return lines;
}

// POST /api/erp/work-orders/:id/invoice   generate invoice from a work order
async function generateFromWorkOrder(req, res) {
  const wo = await WorkOrder.findById(req.params.id);
  if (!wo) throw new ApiError(404, "Work order not found");
  if (wo.invoice) throw new ApiError(409, "Work order already invoiced");

  const s = await Settings.get();
  recalcWorkOrder(wo, s);

  // Deduct part stock once at invoicing; alert if a part drops to/below reorder level.
  for (const p of wo.partItems) {
    if (p.part && !p.stockDeducted) {
      const updated = await Part.findByIdAndUpdate(
        p.part,
        { $inc: { quantityInStock: -Math.abs(p.quantity || 0) } },
        { new: true }
      );
      p.stockDeducted = true;
      if (updated && updated.quantityInStock <= updated.reorderLevel) {
        notify({
          role: "manager", type: "low_stock",
          title: "Low stock alert",
          body: `${updated.name} is low (${updated.quantityInStock} left, reorder at ${updated.reorderLevel})`,
          link: `/parts/${updated._id}`,
        });
      }
    }
  }

  const seq = await nextSeq("invoice", s.invoiceStartNumber || 3001);
  const dueDate = s.invoiceDueDays > 0 ? new Date(Date.now() + s.invoiceDueDays * 86400000) : new Date();

  const invoice = await Invoice.create({
    invoiceNumber: formatNumber(s.invoicePrefix, seq),
    workOrder: wo._id,
    customer: wo.customer,
    vehicle: wo.vehicle,
    lineItems: snapshotLines(wo),
    subtotal: round2(wo.laborSubtotal + wo.partsSubtotal),
    discountType: wo.discountType,
    discount: wo.discount,
    taxRate: wo.taxRate,
    taxAmount: wo.taxAmount,
    shopSuppliesFee: wo.shopSuppliesFee,
    total: wo.total,
    amountPaid: 0,
    amountDue: wo.total,
    status: "draft",
    dueDate,
    createdBy: req.auth.id,
  });

  wo.invoice = invoice._id;
  wo.status = "invoiced";
  await wo.save();

  res.status(201).json({ success: true, data: invoice });
}

// GET /api/erp/invoices?status=&customer=&overdue=true
async function list(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.customer) filter.customer = req.query.customer;
  if (req.query.overdue === "true") {
    filter.status = { $in: ["sent", "partial"] };
    filter.dueDate = { $lt: new Date() };
  }
  const result = await paginate(Invoice, filter, {
    ...req.query,
    populate: [
      { path: "customer", select: "name phone" },
      { path: "vehicle", select: "year make model" },
    ],
  });
  res.json({ success: true, ...result });
}

async function getOne(req, res) {
  const invoice = await Invoice.findById(req.params.id)
    .populate("customer", "name phone email address")
    .populate("vehicle")
    .populate("payments");
  if (!invoice) throw new ApiError(404, "Invoice not found");
  res.json({ success: true, data: invoice });
}

// POST /api/erp/invoices/:id/send   mark as sent + email the invoice to the customer
// Optional body: { email } to override / supply the recipient (walk-in with no email on file).
async function send(req, res) {
  const invoice = await Invoice.findById(req.params.id)
    .populate("customer", "name email")
    .populate("vehicle", "year make model vin");
  if (!invoice) throw new ApiError(404, "Invoice not found");

  invoice.status = invoice.amountDue <= 0 ? "paid" : "sent";
  invoice.sentAt = new Date();
  await invoice.save();

  // Email the invoice (best-effort — never blocks the response).
  let email = { skipped: true, reason: "customer has no email on file" };
  const to = (req.body && req.body.email) || invoice.customer?.email;
  if (to) {
    try {
      const settings = (await Settings.findById("shop").lean()) || {};
      const html = emailSvc.tplInvoice(invoice, settings, invoice.customer, invoice.vehicle);
      const subject = `Invoice ${invoice.invoiceNumber} from ${settings.shopName || "Road Hustlers"}`;
      email = await emailSvc.sendEmail(to, subject, html);
    } catch (e) {
      email = { success: false, error: e.message };
    }
  }

  res.json({ success: true, data: invoice, message: "Invoice sent", email });
}

// POST /api/erp/invoices/:id/void  (admin/manager)
// Restores deducted part stock and re-opens the work order so it can be re-billed.
async function voidInvoice(req, res) {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw new ApiError(404, "Invoice not found");
  if (invoice.amountPaid > 0) throw new ApiError(409, "Cannot void an invoice with payments — refund first");

  const wo = await WorkOrder.findById(invoice.workOrder);
  if (wo) {
    for (const p of wo.partItems) {
      if (p.part && p.stockDeducted) {
        await Part.findByIdAndUpdate(p.part, { $inc: { quantityInStock: Math.abs(p.quantity || 0) } });
        p.stockDeducted = false;
      }
    }
    wo.invoice = null;
    wo.status = "completed"; // back to billable state
    await wo.save();
  }

  invoice.status = "void";
  await invoice.save();
  res.json({ success: true, data: invoice, message: "Invoice voided, stock restored, work order re-opened" });
}

module.exports = { generateFromWorkOrder, list, getOne, send, voidInvoice };
