const SubscriptionPlan = require("../../../models/Subscription");
const { PartnerSubscription } = require("../../../models/Subscription");

// POST /admin/plans
async function createPlan(req, res) {
  const plan = await SubscriptionPlan.create(req.body);
  return res.status(201).json({ success: true, plan });
}

// GET /admin/plans
async function listPlans(req, res) {
  const plans = await SubscriptionPlan.find().sort({ sortOrder: 1, price: 1 });
  return res.json({ success: true, plans });
}

// PUT /admin/plans/:id
async function updatePlan(req, res) {
  const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
  return res.json({ success: true, plan });
}

// DELETE /admin/plans/:id
async function deletePlan(req, res) {
  await SubscriptionPlan.findByIdAndDelete(req.params.id);
  return res.json({ success: true, message: "Plan deleted" });
}

// GET /admin/subscriptions — all partner subscriptions
async function listSubscriptions(req, res) {
  const { page = 1, limit = 20, status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [subs, total] = await Promise.all([
    PartnerSubscription.find(filter)
      .populate("partner", "name phone")
      .populate("plan", "name price")
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    PartnerSubscription.countDocuments(filter),
  ]);

  return res.json({
    success: true, subscriptions: subs,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

module.exports = { createPlan, listPlans, updatePlan, deletePlan, listSubscriptions };
