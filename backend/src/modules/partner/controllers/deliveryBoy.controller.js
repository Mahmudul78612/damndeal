const DeliveryBoy = require("../../../models/DeliveryBoy");

// POST /partner/delivery-boys — partner adds own delivery boy
async function addDeliveryBoy(req, res) {
  const partnerId = req.user.userId;
  const { name, phone, email, aadhaarNumber, vehicleType, vehicleNumber } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ success: false, message: "name and phone required" });
  }

  // Check duplicate phone under this partner
  const existing = await DeliveryBoy.findOne({ partner: partnerId, phone });
  if (existing) {
    return res.status(409).json({ success: false, message: "Delivery boy with this phone already exists" });
  }

  const photo = req.file ? `/uploads/delivery/${req.file.filename}` : null;

  const boy = await DeliveryBoy.create({
    partner: partnerId,
    name,
    phone,
    email: email || null,
    photo,
    aadhaarNumber: aadhaarNumber || null,
    vehicleType: vehicleType || "bike",
    vehicleNumber: vehicleNumber || null,
    isVerified: true, // partner-added boys are auto-verified
  });

  return res.status(201).json({ success: true, deliveryBoy: boy });
}

// GET /partner/delivery-boys — list partner's own boys
async function getDeliveryBoys(req, res) {
  const { page = 1, limit = 20, search } = req.query;
  const filter = { partner: req.user.userId };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [boys, total] = await Promise.all([
    DeliveryBoy.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    DeliveryBoy.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    deliveryBoys: boys,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / parseInt(limit, 10)),
    },
  });
}

// GET /partner/delivery-boys/:id
async function getDeliveryBoy(req, res) {
  const boy = await DeliveryBoy.findOne({ _id: req.params.id, partner: req.user.userId });
  if (!boy) return res.status(404).json({ success: false, message: "Delivery boy not found" });
  return res.json({ success: true, deliveryBoy: boy });
}

// PUT /partner/delivery-boys/:id
async function updateDeliveryBoy(req, res) {
  const boy = await DeliveryBoy.findOne({ _id: req.params.id, partner: req.user.userId });
  if (!boy) return res.status(404).json({ success: false, message: "Delivery boy not found" });

  const { name, phone, email, aadhaarNumber, vehicleType, vehicleNumber } = req.body;
  if (name) boy.name = name;
  if (phone) boy.phone = phone;
  if (email !== undefined) boy.email = email;
  if (aadhaarNumber !== undefined) boy.aadhaarNumber = aadhaarNumber;
  if (vehicleType) boy.vehicleType = vehicleType;
  if (vehicleNumber !== undefined) boy.vehicleNumber = vehicleNumber;
  if (req.file) boy.photo = `/uploads/delivery/${req.file.filename}`;

  await boy.save();
  return res.json({ success: true, deliveryBoy: boy });
}

// DELETE /partner/delivery-boys/:id
async function removeDeliveryBoy(req, res) {
  const boy = await DeliveryBoy.findOneAndDelete({ _id: req.params.id, partner: req.user.userId });
  if (!boy) return res.status(404).json({ success: false, message: "Delivery boy not found" });
  return res.json({ success: true, message: "Delivery boy removed" });
}

// PUT /partner/delivery-boys/:id/toggle — toggle active/inactive
async function toggleDeliveryBoy(req, res) {
  const boy = await DeliveryBoy.findOne({ _id: req.params.id, partner: req.user.userId });
  if (!boy) return res.status(404).json({ success: false, message: "Delivery boy not found" });

  boy.isOnline = !boy.isOnline;
  await boy.save();
  return res.json({ success: true, isOnline: boy.isOnline });
}

module.exports = {
  addDeliveryBoy,
  getDeliveryBoys,
  getDeliveryBoy,
  updateDeliveryBoy,
  removeDeliveryBoy,
  toggleDeliveryBoy,
};
