const SupportTicket = require("../../../models/SupportTicket");

// POST /partner/tickets
async function createTicket(req, res) {
  const { orderId, subject, category, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ success: false, message: "subject and message required" });
  }

  const count = await SupportTicket.countDocuments();
  const ticketNumber = `TKT-${String(count + 1).padStart(6, "0")}`;

  const ticket = await SupportTicket.create({
    ticketNumber,
    user: req.user.userId,
    userRole: "partner",
    order: orderId || undefined,
    subject,
    category: category || "other",
    messages: [{ sender: req.user.userId, senderRole: "partner", text: message }],
  });

  return res.status(201).json({ success: true, ticket });
}

// GET /partner/tickets
async function getMyTickets(req, res) {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = { user: req.user.userId, userRole: "partner" };
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .select("ticketNumber subject category priority status createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    SupportTicket.countDocuments(filter),
  ]);

  return res.json({ success: true, tickets, total, page: Number(page), pages: Math.ceil(total / limit) });
}

// GET /partner/tickets/:id
async function getTicket(req, res) {
  const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.user.userId, userRole: "partner" })
    .populate("order", "orderNumber grandTotal status")
    .lean();

  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
  return res.json({ success: true, ticket });
}

// POST /partner/tickets/:id/reply
async function replyTicket(req, res) {
  const { text } = req.body;
  if (!text) return res.status(400).json({ success: false, message: "text required" });

  const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.user.userId, userRole: "partner" });
  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

  if (ticket.status === "closed") {
    return res.status(400).json({ success: false, message: "Ticket is closed" });
  }

  ticket.messages.push({ sender: req.user.userId, senderRole: "partner", text });
  if (ticket.status === "resolved") ticket.status = "open";
  await ticket.save();

  return res.json({ success: true, ticket });
}

module.exports = { createTicket, getMyTickets, getTicket, replyTicket };
