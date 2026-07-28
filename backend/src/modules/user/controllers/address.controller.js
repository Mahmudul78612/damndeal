const Address = require("../../../models/Address");

async function getAddresses(req, res) {
  const addresses = await Address.find({ user: req.user.userId }).sort({ isDefault: -1, createdAt: -1 });
  return res.json({ success: true, addresses });
}

async function addAddress(req, res) {
  const isUS = req.region === "US";
  const { label, address, landmark, city, state, isDefault } = req.body;
  const pincode = req.body.pincode || null;
  const zip = req.body.zip || null;
  // Accept both lat/lng and latitude/longitude. Coordinates are optional
  // (only used for India local delivery; US ships via CJ so not needed).
  const lat = req.body.lat ?? req.body.latitude ?? null;
  const lng = req.body.lng ?? req.body.longitude ?? null;

  if (!address || !city || !state) {
    return res.status(400).json({ success: false, message: "Address, city and state are required" });
  }
  if (isUS && !zip) {
    return res.status(400).json({ success: false, message: "ZIP code is required" });
  }
  if (!isUS && !pincode) {
    return res.status(400).json({ success: false, message: "Pincode is required" });
  }

  if (isDefault) {
    await Address.updateMany({ user: req.user.userId }, { isDefault: false });
  }

  const addr = await Address.create({
    user: req.user.userId, label, address, landmark, city, state,
    pincode: isUS ? null : pincode,
    zip: isUS ? zip : null,
    country: isUS ? "US" : "IN",
    lat: lat != null && lat !== "" ? Number(lat) : null,
    lng: lng != null && lng !== "" ? Number(lng) : null,
    isDefault: isDefault || false,
  });

  return res.status(201).json({ success: true, address: addr });
}

async function updateAddress(req, res) {
  if (req.body.isDefault) {
    await Address.updateMany({ user: req.user.userId }, { isDefault: false });
  }

  // Normalize coordinate aliases + region fields.
  const body = { ...req.body };
  if (body.latitude !== undefined) { body.lat = body.latitude === "" ? null : Number(body.latitude); delete body.latitude; }
  if (body.longitude !== undefined) { body.lng = body.longitude === "" ? null : Number(body.longitude); delete body.longitude; }
  if (req.region === "US") { body.country = "US"; if (body.zip) body.pincode = null; }

  const addr = await Address.findOneAndUpdate(
    { _id: req.params.id, user: req.user.userId }, body, { new: true }
  );
  if (!addr) return res.status(404).json({ success: false, message: "Address not found" });

  return res.json({ success: true, address: addr });
}

async function deleteAddress(req, res) {
  const addr = await Address.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
  if (!addr) return res.status(404).json({ success: false, message: "Address not found" });
  return res.json({ success: true, message: "Address deleted" });
}

module.exports = { getAddresses, addAddress, updateAddress, deleteAddress };
