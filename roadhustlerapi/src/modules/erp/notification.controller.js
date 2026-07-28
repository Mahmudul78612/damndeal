const Notification = require("../../models/Notification");
const { paginate } = require("../../utils/paginate");

// Role hierarchy — higher roles also receive notifications targeted at lower roles.
const ROLE_INBOX = {
  staff: ["staff"],
  manager: ["staff", "manager"],
  admin: ["staff", "manager", "admin"],
};

// GET /api/erp/notifications  — own + role broadcasts (respecting hierarchy)
async function list(req, res) {
  const roles = ROLE_INBOX[req.auth.role] || [req.auth.role];
  const filter = {
    $or: [
      { recipientType: "User", recipient: req.auth.id },
      { recipientType: "role", role: { $in: roles } },
      { recipientType: "role", role: null },
    ],
  };
  const result = await paginate(Notification, filter, req.query);
  const unread = await Notification.countDocuments({ ...filter, isRead: false });
  res.json({ success: true, ...result, unread });
}

// PATCH /api/erp/notifications/:id/read
async function markRead(req, res) {
  await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
  res.json({ success: true });
}

// PATCH /api/erp/notifications/read-all
async function markAllRead(req, res) {
  await Notification.updateMany(
    { $or: [{ recipient: req.auth.id }, { role: req.auth.role }] },
    { isRead: true }
  );
  res.json({ success: true });
}

module.exports = { list, markRead, markAllRead };
