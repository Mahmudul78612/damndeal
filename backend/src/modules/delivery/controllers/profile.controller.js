const DeliveryBoy = require("../../../models/DeliveryBoy");
const User = require("../../../models/User");

// POST /delivery/profile — create/update profile
async function upsertProfile(req, res) {
  const { name, phone, email, aadhaarNumber, vehicleType, vehicleNumber } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "name required" });

  const photo = req.file ? `/uploads/delivery/${req.file.filename}` : undefined;
  const data = { name, phone, email, aadhaarNumber, vehicleType, vehicleNumber };
  if (photo) data.photo = photo;

  let boy = await DeliveryBoy.findOne({ user: req.user.userId });
  if (boy) {
    Object.assign(boy, data);
    await boy.save();
  } else {
    boy = await DeliveryBoy.create({ user: req.user.userId, ...data });
  }

  // Update user profile
  await User.findByIdAndUpdate(req.user.userId, {
    name, email, isProfileComplete: true,
  });

  return res.json({ success: true, profile: boy });
}

// GET /delivery/profile
async function getProfile(req, res) {
  const boy = await DeliveryBoy.findOne({ user: req.user.userId });
  if (!boy) return res.status(404).json({ success: false, message: "Profile not created yet" });
  return res.json({ success: true, profile: boy });
}

// PUT /delivery/location — update live location
async function updateLocation(req, res) {
  const { lat, lng } = req.body;
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ success: false, message: "lat and lng required" });
  }

  const boy = await DeliveryBoy.findOneAndUpdate(
    { user: req.user.userId },
    { location: { type: "Point", coordinates: [lng, lat] } },
    { new: true }
  );
  if (!boy) return res.status(404).json({ success: false, message: "Profile not found" });

  return res.json({ success: true });
}

// PUT /delivery/toggle-online
async function toggleOnline(req, res) {
  const boy = await DeliveryBoy.findOne({ user: req.user.userId });
  if (!boy) return res.status(404).json({ success: false, message: "Profile not found" });

  boy.isOnline = !boy.isOnline;
  await boy.save();
  return res.json({ success: true, isOnline: boy.isOnline });
}

module.exports = { upsertProfile, getProfile, updateLocation, toggleOnline };
