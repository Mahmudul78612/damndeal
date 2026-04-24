const SupportTicket = require("../../../models/SupportTicket");

// GET /admin/tickets
async function listTickets(req, res) {
  const { page = 1, limit = 20, status, priority, category } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (category) filter.category = category;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .populate("user", "name phone role")
      .populate("assignedTo", "name")
      .populate("order", "orderNumber")
      .select("-messages")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    SupportTicket.countDocuments(filter),
  ]);

  return res.json({
    success: true, tickets,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// GET /admin/tickets/:id
async function getTicket(req, res) {
  const ticket = await SupportTicket.findById(req.params.id)
    .populate("user", "name phone role")
    .populate("assignedTo", "name")
    .populate("order", "orderNumber grandTotal status")
    .populate("messages.sender", "name role");

  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
  return res.json({ success: true, ticket });
}

// PUT /admin/tickets/:id/assign
async function assignTicket(req, res) {
  const { staffId } = req.body;
  const ticket = await SupportTicket.findByIdAndUpdate(
    req.params.id,
    { assignedTo: staffId, status: "in_progress" },
    { new: true }
  );
  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
  return res.json({ success: true, ticket });
}

// POST /admin/tickets/:id/reply
async function replyTicket(req, res) {
  const { text } = req.body;
  if (!text) return res.status(400).json({ success: false, message: "text required" });

  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

  ticket.messages.push({
    sender: req.user.userId,
    senderRole: "admin",
    text,
  });
  if (ticket.status === "open") ticket.status = "in_progress";
  await ticket.save();

  return res.json({ success: true, ticket });
}

// PUT /admin/tickets/:id/resolve
async function resolveTicket(req, res) {
  const ticket = await SupportTicket.findByIdAndUpdate(
    req.params.id,
    { status: "resolved", resolvedAt: new Date() },
    { new: true }
  );
  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
  return res.json({ success: true, ticket });
}

// PUT /admin/tickets/:id/close
async function closeTicket(req, res) {
  const ticket = await SupportTicket.findByIdAndUpdate(
    req.params.id,
    { status: "closed" },
    { new: true }
  );
  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
  return res.json({ success: true, ticket });
}

module.exports = { listTickets, getTicket, assignTicket, replyTicket, resolveTicket, closeTicket };
