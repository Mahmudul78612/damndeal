const Customer = require("../../../models/Customer");

async function getCustomers(req, res) {
  const { page = 1, limit = 20, search } = req.query;
  const filter = { partner: req.user.userId };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [customers, total] = await Promise.all([
    Customer.find(filter).sort({ totalSpent: -1 }).skip(skip).limit(parseInt(limit, 10)),
    Customer.countDocuments(filter),
  ]);

  return res.json({
    success: true, customers,
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total, pages: Math.ceil(total / parseInt(limit, 10)) },
  });
}

async function getCustomer(req, res) {
  const customer = await Customer.findOne({ _id: req.params.id, partner: req.user.userId });
  if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
  return res.json({ success: true, customer });
}

module.exports = { getCustomers, getCustomer };
