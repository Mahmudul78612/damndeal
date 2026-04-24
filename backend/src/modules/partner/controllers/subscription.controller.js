const Subscription = require("../../../models/Subscription");
const { SubscriptionPlan, PartnerSubscription } = Subscription;

// GET /partner/subscription/plans — list available plans
async function listPlans(req, res) {
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 }).lean();
  return res.json({ success: true, plans });
}

// POST /partner/subscription/subscribe — subscribe to a plan
async function subscribe(req, res) {
  const { planId, paymentId } = req.body;
  if (!planId) return res.status(400).json({ success: false, message: "planId required" });

  const plan = await SubscriptionPlan.findById(planId);
  if (!plan || !plan.isActive) return res.status(404).json({ success: false, message: "Plan not found" });

  // Check active subscription
  const active = await PartnerSubscription.findOne({
    partner: req.user.userId,
    status: "active",
    endDate: { $gte: new Date() },
  });
  if (active) return res.status(400).json({ success: false, message: "You already have an active subscription" });

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.durationDays);

  const sub = await PartnerSubscription.create({
    partner: req.user.userId,
    plan: plan._id,
    startDate,
    endDate,
    paymentId: paymentId || null,
    amount: plan.price,
    status: "active",
  });

  return res.status(201).json({ success: true, subscription: sub });
}

// GET /partner/subscription — my current subscription
async function getMySubscription(req, res) {
  const sub = await PartnerSubscription.findOne({
    partner: req.user.userId,
    status: "active",
    endDate: { $gte: new Date() },
  })
    .populate("plan")
    .lean();

  return res.json({ success: true, subscription: sub || null });
}

// GET /partner/subscription/history
async function subscriptionHistory(req, res) {
  const subs = await PartnerSubscription.find({ partner: req.user.userId })
    .populate("plan", "name price durationDays")
    .sort({ createdAt: -1 })
    .lean();

  return res.json({ success: true, subscriptions: subs });
}

module.exports = { listPlans, subscribe, getMySubscription, subscriptionHistory };
