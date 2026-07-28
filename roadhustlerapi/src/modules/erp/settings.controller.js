const Settings = require("../../models/Settings");

// GET /api/erp/settings
async function getSettings(_req, res) {
  const settings = await Settings.get();
  res.json({ success: true, data: settings });
}

// PUT /api/erp/settings (admin)
async function updateSettings(req, res) {
  const settings = await Settings.findByIdAndUpdate("shop", { $set: req.body }, { new: true, upsert: true });
  res.json({ success: true, data: settings });
}

module.exports = { getSettings, updateSettings };
