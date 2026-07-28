const Payment = require("../../models/Payment");
const Invoice = require("../../models/Invoice");
const Customer = require("../../models/Customer");
const { round2 } = require("../../utils/money");
const { paginate } = require("../../utils/paginate");
const { notify } = require("../../utils/notify");
const { ApiError } = require("../../middleware/error.middleware");

// Apply a payment to an invoice and update statuses + customer lifetime spend.
async function applyPayment({ invoice, amount, method, reference, receivedBy, note, stripePaymentIntent }) {
  if (!amount || amount <= 0) throw new ApiError(400, "amount must be greater than 0");
  if (invoice.status === "void") throw new ApiError(409, "Cannot pay a void invoice");

  const payment = await Payment.create({
    invoice: invoice._id,
    customer: invoice.customer,
    amount: round2(amount),
    method: method || "cash",
    reference,
    stripePaymentIntent,
    receivedBy: receivedBy || null,
    note,
  });

  invoice.payments.push(payment._id);
  invoice.amountPaid = round2(invoice.amountPaid + payment.amount);
  invoice.amountDue = round2(Math.max(0, invoice.total - invoice.amountPaid));
  invoice.status = invoice.amountDue <= 0 ? "paid" : "partial";
  await invoice.save();

  // lifetime customer spend
  await Customer.findByIdAndUpdate(invoice.customer, { $inc: { totalSpent: payment.amount } });

  if (invoice.status === "paid") {
    notify({ role: "manager", type: "invoice_paid", title: "Invoice paid", body: `${invoice.invoiceNumber} fully paid`, link: `/invoices/${invoice._id}` });
  }
  return payment;
}

// POST /api/erp/invoices/:id/payments   (in-shop payment)
async function recordPayment(req, res) {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw new ApiError(404, "Invoice not found");
  const payment = await applyPayment({
    invoice,
    amount: Number(req.body.amount),
    method: req.body.method,
    reference: req.body.reference,
    receivedBy: req.auth.id,
    note: req.body.note,
  });
  res.status(201).json({ success: true, data: { payment, invoice } });
}

// POST /api/erp/payments   { invoiceId, amount, method, reference, note }
// Alias for the frontend ERPPayments screen — the invoice id arrives in the body.
async function createPayment(req, res) {
  const invoice = await Invoice.findById(req.body.invoiceId || req.body.invoice);
  if (!invoice) throw new ApiError(404, "Invoice not found");
  const payment = await applyPayment({
    invoice,
    amount: Number(req.body.amount),
    method: req.body.method,
    reference: req.body.reference,
    receivedBy: req.auth.id,
    note: req.body.note,
  });
  res.status(201).json({ success: true, data: { payment, invoice } });
}

// POST /api/erp/invoices/:id/refund   { amount?, method?, reason? }
// Records a refund (negative payment), adjusts the invoice and customer lifetime spend.
async function refundPayment(req, res) {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw new ApiError(404, "Invoice not found");
  if (invoice.amountPaid <= 0) throw new ApiError(400, "Nothing to refund");

  const amount = round2(Number(req.body.amount) || invoice.amountPaid);
  if (amount <= 0 || amount > invoice.amountPaid) {
    throw new ApiError(400, `Refund must be between 0 and ${invoice.amountPaid}`);
  }

  const refund = await Payment.create({
    invoice: invoice._id,
    customer: invoice.customer,
    amount: -amount, // negative = money out
    method: req.body.method || "other",
    receivedBy: req.auth.id,
    note: `Refund${req.body.reason ? ": " + req.body.reason : ""}`,
  });

  invoice.payments.push(refund._id);
  invoice.amountPaid = round2(invoice.amountPaid - amount);
  invoice.amountDue = round2(invoice.total - invoice.amountPaid);
  invoice.status = invoice.amountPaid <= 0
    ? (invoice.sentAt ? "sent" : "draft")
    : (invoice.amountDue > 0 ? "partial" : "paid");
  await invoice.save();

  await Customer.findByIdAndUpdate(invoice.customer, { $inc: { totalSpent: -amount } });

  res.status(201).json({ success: true, data: { refund, invoice }, message: "Refund recorded" });
}

// GET /api/erp/payments?from=&to=&method=   (daybook)
async function list(req, res) {
  const filter = {};
  if (req.query.method) filter.method = req.query.method;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }
  const result = await paginate(Payment, filter, {
    ...req.query,
    populate: [
      { path: "invoice", select: "invoiceNumber" },
      { path: "customer", select: "name" },
      { path: "receivedBy", select: "name" },
    ],
  });
  const totalCollected = (await Payment.aggregate([{ $match: filter }, { $group: { _id: null, sum: { $sum: "$amount" } } }]))[0]?.sum || 0;
  res.json({ success: true, ...result, totalCollected: round2(totalCollected) });
}

module.exports = { recordPayment, createPayment, refundPayment, list, applyPayment };
