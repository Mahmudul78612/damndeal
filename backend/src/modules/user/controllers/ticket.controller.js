const SupportTicket = require("../../../models/SupportTicket");
const crypto = require("crypto");

function genTicketNumber() {
  return "TKT-" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString("hex").toUpperCase();
}

// POST /user/tickets — create support ticket
async function createTicket(req, res) {
  const { subject, category, orderId, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ success: false, message: "subject and message required" });
  }

  const ticket = await SupportTicket.create({
    ticketNumber: genTicketNumber(),
    user: req.user.userId,
    userRole: req.user.role || "user",
    order: orderId || null,
    subject,
    category: category || "other",
    messages: [{
      sender: req.user.userId,
      senderRole: req.user.role || "user",
      text: message,
    }],
  });

  return res.status(201).json({ success: true, ticket });
}

// GET /user/tickets
async function getMyTickets(req, res) {
  const tickets = await SupportTicket.find({ user: req.user.userId })
    .select("-messages")
    .sort({ createdAt: -1 });

  return res.json({ success: true, tickets });
}

// GET /user/tickets/:id
async function getTicket(req, res) {
  const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.user.userId })
    .populate("messages.sender", "name role");

  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
  return res.json({ success: true, ticket });
}

// POST /user/tickets/:id/reply
async function replyTicket(req, res) {
  const { text } = req.body;
  if (!text) return res.status(400).json({ success: false, message: "text required" });

  const ticket = await SupportTicket.findOne({ _id: req.params.id, user: req.user.userId });
  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

  if (ticket.status === "closed") {
    return res.status(400).json({ success: false, message: "Ticket is closed" });
  }

  ticket.messages.push({
    sender: req.user.userId,
    senderRole: req.user.role || "user",
    text,
  });
  if (ticket.status === "resolved") ticket.status = "open"; // reopen
  await ticket.save();

  return res.json({ success: true, ticket });
}

module.exports = { createTicket, getMyTickets, getTicket, replyTicket };
