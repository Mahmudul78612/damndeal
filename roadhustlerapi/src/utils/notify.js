const Notification = require("../models/Notification");

// Create an in-app notification. Fire-and-forget (never blocks the request).
//   notify({ role: "manager", type, title, body, link })
//   notify({ recipientType: "Customer", recipient: id, ... })
async function notify(payload) {
  try {
    await Notification.create(payload);
  } catch (e) {
    console.error("[notify] failed:", e.message);
  }
}

module.exports = { notify };
