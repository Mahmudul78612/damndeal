const Notification = require("../../../models/Notification");
const User = require("../../../models/User");

let _admin = null;
function _getAdmin() {
  if (_admin) return _admin;
  try {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (path) {
        admin.initializeApp({ credential: admin.credential.cert(require(path)) });
      } else if (json) {
        admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
      } else {
        console.warn("[FCM] No service account configured — push disabled.");
        return null;
      }
    }
    _admin = admin;
  } catch (e) {
    console.error("[FCM] Init error:", e.message);
    return null;
  }
  return _admin;
}

// POST /admin/notifications
async function createNotification(req, res) {
  const { title, body, image, type, targetUser, data, scheduledAt } = req.body;
  if (!title || !body) return res.status(400).json({ success: false, message: "title and body required" });

  const notification = await Notification.create({
    title, body, image, type: type || "all",
    targetUser: targetUser || null,
    data: data || {},
    scheduledAt: scheduledAt || null,
    status: scheduledAt ? "scheduled" : "draft",
    sentBy: req.user.userId,
  });

  return res.status(201).json({ success: true, notification });
}

// GET /admin/notifications
async function listNotifications(req, res) {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [notifications, total] = await Promise.all([
    Notification.find().sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Notification.countDocuments(),
  ]);

  return res.json({
    success: true, notifications,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// POST /admin/notifications/:id/send
async function sendNotification(req, res) {
  const notification = await Notification.findById(req.params.id);
  if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });

  // Build target FCM tokens
  let tokens = [];
  if (notification.type === "individual" && notification.targetUser) {
    const u = await User.findById(notification.targetUser);
    if (u?.fcmToken) tokens.push(u.fcmToken);
  } else {
    const roleFilter = {};
    if (notification.type === "users") roleFilter.role = "user";
    else if (notification.type === "partners") roleFilter.role = "partner";
    else if (notification.type === "delivery") roleFilter.role = "delivery";

    const users = await User.find({ ...roleFilter, fcmToken: { $ne: null } }).select("fcmToken");
    tokens = users.map((u) => u.fcmToken);
  }

  let sent = 0;
  if (tokens.length > 0) {
    const admin = _getAdmin();
    if (admin) {
      try {
        const msg = {
          tokens,
          notification: { title: notification.title, body: notification.body },
          ...(notification.image && { android: { notification: { imageUrl: notification.image } } }),
        };
        const result = await admin.messaging().sendEachForMulticast(msg);
        sent = result.successCount;
        // Remove invalid tokens
        result.responses.forEach((r, i) => {
          if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
            User.findOneAndUpdate({ fcmToken: tokens[i] }, { fcmToken: null }).catch(() => {});
          }
        });
      } catch (e) {
        console.error("[FCM] Send error:", e.message);
      }
    }
  }

  notification.status = "sent";
  notification.sentAt = new Date();
  await notification.save();

  return res.json({ success: true, message: `Notification sent to ${sent}/${tokens.length} devices`, notification });
}

// DELETE /admin/notifications/:id
async function deleteNotification(req, res) {
  const n = await Notification.findByIdAndDelete(req.params.id);
  if (!n) return res.status(404).json({ success: false, message: "Notification not found" });
  return res.json({ success: true, message: "Notification deleted" });
}

module.exports = { createNotification, listNotifications, sendNotification, deleteNotification };
