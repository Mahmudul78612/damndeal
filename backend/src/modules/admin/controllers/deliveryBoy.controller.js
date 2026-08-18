const User = require("../../../models/User");
const DeliveryBoy = require("../../../models/DeliveryBoy");

// GET /admin/delivery-boys
async function listDeliveryBoys(req, res) {
  const { page = 1, limit = 20, isVerified, isOnline, store } = req.query;
  const filter = {};
  if (isVerified !== undefined) filter.isVerified = isVerified === "true";
  if (isOnline !== undefined) filter.isOnline = isOnline === "true";
  // "unassigned" is a real thing to look for, so an empty string cannot mean
  // "no filter" here.
  if (store === "none") filter.store = null;
  else if (store) filter.store = store;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [boys, total] = await Promise.all([
    DeliveryBoy.find(filter).populate("user", "phone isActive lastLogin").populate("store", "name code city")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    DeliveryBoy.countDocuments(filter),
  ]);

  return res.json({
    success: true, deliveryBoys: boys,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

// PUT /admin/delivery-boys/:id/verify
async function verifyDeliveryBoy(req, res) {
  const boy = await DeliveryBoy.findById(req.params.id);
  if (!boy) return res.status(404).json({ success: false, message: "Delivery boy not found" });

  boy.isVerified = true;
  boy.verifiedBy = req.user.userId;
  await boy.save();

  return res.json({ success: true, deliveryBoy: boy });
}

// PUT /admin/delivery-boys/:id/toggle
async function toggleDeliveryBoy(req, res) {
  const boy = await DeliveryBoy.findById(req.params.id);
  if (!boy) return res.status(404).json({ success: false, message: "Delivery boy not found" });

  const user = await User.findById(boy.user);
  user.isActive = !user.isActive;
  await user.save();

  return res.json({ success: true, isActive: user.isActive });
}


/* PUT /admin/delivery-boys/:id/store  { store: <id|null> }
   A DDGo rider works a shift out of one dark store, so assignment can start
   from the store that packed the order instead of scanning every rider in the
   city. Sending null puts them back in the floating pool. */
async function assignStore(req, res) {
  const boy = await DeliveryBoy.findById(req.params.id);
  if (!boy) return res.status(404).json({ success: false, message: "Delivery boy not found" });

  const storeId = req.body.store || null;
  if (storeId) {
    const DarkStore = require("../../../models/DarkStore");
    const exists = await DarkStore.exists({ _id: storeId });
    if (!exists) return res.status(400).json({ success: false, message: "That store does not exist" });
  }
  boy.store = storeId;
  await boy.save();
  return res.json({ success: true, deliveryBoy: boy });
}

module.exports = { listDeliveryBoys, verifyDeliveryBoy, toggleDeliveryBoy, assignStore };
