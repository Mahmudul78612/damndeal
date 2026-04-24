const Address = require("../../../models/Address");

async function getAddresses(req, res) {
  const addresses = await Address.find({ user: req.user.userId }).sort({ isDefault: -1, createdAt: -1 });
  return res.json({ success: true, addresses });
}

async function addAddress(req, res) {
  const { label, address, landmark, city, state, pincode, lat, lng, isDefault } = req.body;
  if (!address || !city || !state || !pincode || lat === undefined || lng === undefined) {
    return res.status(400).json({ success: false, message: "address, city, state, pincode, lat, lng required" });
  }

  if (isDefault) {
    await Address.updateMany({ user: req.user.userId }, { isDefault: false });
  }

  const addr = await Address.create({
    user: req.user.userId, label, address, landmark, city, state, pincode, lat, lng,
    isDefault: isDefault || false,
  });

  return res.status(201).json({ success: true, address: addr });
}

async function updateAddress(req, res) {
  if (req.body.isDefault) {
    await Address.updateMany({ user: req.user.userId }, { isDefault: false });
  }

  const addr = await Address.findOneAndUpdate(
    { _id: req.params.id, user: req.user.userId }, req.body, { new: true }
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
