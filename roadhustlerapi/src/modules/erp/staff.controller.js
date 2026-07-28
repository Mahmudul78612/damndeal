const User = require("../../models/User");
const WorkOrder = require("../../models/WorkOrder");
const { paginate } = require("../../utils/paginate");
const { ApiError } = require("../../middleware/error.middleware");

// GET /api/erp/staff
async function list(req, res) {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) filter.name = new RegExp(req.query.search.trim(), "i");
  const result = await paginate(User, filter, { ...req.query, sort: { name: 1 } });
  res.json({ success: true, ...result });
}

// POST /api/erp/staff   (admin/manager creates technician/advisor)
async function create(req, res) {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) throw new ApiError(400, "name, email and password are required");
  if (role === "admin" && req.auth.role !== "admin") throw new ApiError(403, "Only an admin can create admins");
  const user = new User({
    name,
    email: email.toLowerCase(),
    phone: req.body.phone,
    role: role || "staff",
    hourlyRate: req.body.hourlyRate || 0,
    specialties: req.body.specialties || [],
  });
  await user.setPassword(password);
  await user.save();
  res.status(201).json({ success: true, data: user });
}

// PUT /api/erp/staff/:id
async function update(req, res) {
  const updates = { ...req.body };
  delete updates.passwordHash;
  if (updates.password) {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, "Staff not found");
    await user.setPassword(updates.password);
    delete updates.password;
    Object.assign(user, updates);
    await user.save();
    return res.json({ success: true, data: user });
  }
  if (updates.role === "admin" && req.auth.role !== "admin") throw new ApiError(403, "Only an admin can assign admin role");
  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!user) throw new ApiError(404, "Staff not found");
  res.json({ success: true, data: user });
}

// GET /api/erp/staff/:id/timesheet?from=&to=   (hours + productivity)
async function timesheet(req, res) {
  const techId = req.params.id;
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400000);
  const to = req.query.to ? new Date(req.query.to) : new Date();

  const orders = await WorkOrder.find({
    assignedTechs: techId,
    createdAt: { $gte: from, $lte: to },
  }).select("orderNumber timeLog laborItems completedAt status");

  let totalMinutes = 0;
  let billableHours = 0;
  let jobsCompleted = 0;
  orders.forEach((wo) => {
    wo.timeLog.forEach((t) => { if (String(t.tech) === String(techId)) totalMinutes += t.minutes || 0; });
    wo.laborItems.forEach((l) => { if (String(l.tech) === String(techId)) billableHours += l.hours || 0; });
    if (wo.status === "completed" || wo.status === "invoiced") jobsCompleted += 1;
  });

  res.json({
    success: true,
    data: {
      from, to,
      clockedHours: Math.round((totalMinutes / 60) * 100) / 100,
      billableHours: Math.round(billableHours * 100) / 100,
      jobsCompleted,
      jobs: orders.length,
    },
  });
}

module.exports = { list, create, update, timesheet };
