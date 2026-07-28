const User = require("../../models/User");
const Customer = require("../../models/Customer");
const { generateTokens, verifyRefresh } = require("../../utils/jwt");
const { ApiError } = require("../../middleware/error.middleware");

// Staff/admin live in User; customers in Customer.
// x-client-type header decides which side logs in: "erp" => staff, "website" => customer.
function principalModel(req) {
  return (req.headers["x-client-type"] || "").toLowerCase() === "website" ? Customer : User;
}

// POST /api/auth/register  (website — customer self-signup)
async function register(req, res) {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) throw new ApiError(400, "name, email and password are required");

  const exists = await Customer.findOne({ email: email.toLowerCase() });
  if (exists) throw new ApiError(409, "An account with this email already exists");

  const customer = new Customer({ name, email: email.toLowerCase(), phone, source: "website" });
  await customer.setPassword(password);
  await customer.save();

  const tokens = generateTokens(customer._id, "customer");
  res.status(201).json({ success: true, user: customer, role: "customer", ...tokens });
}

// POST /api/auth/login  (works for both staff and customers via x-client-type)
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, "email and password are required");

  const Model = principalModel(req);
  const account = await Model.findOne({ email: email.toLowerCase() });
  if (!account || !account.isActive) throw new ApiError(401, "Invalid credentials");
  if (Model === Customer && !account.portalEnabled) throw new ApiError(401, "Portal access not enabled for this account");

  const ok = await account.checkPassword(password);
  if (!ok) throw new ApiError(401, "Invalid credentials");

  const role = Model === Customer ? "customer" : account.role;
  account.lastLogin = new Date();
  await account.save();

  const tokens = generateTokens(account._id, role);
  res.json({ success: true, user: account, role, ...tokens });
}

// POST /api/auth/refresh-token
async function refreshToken(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(400, "refreshToken required");
  let payload;
  try {
    payload = verifyRefresh(refreshToken);
  } catch {
    throw new ApiError(401, "Invalid refresh token");
  }
  const Model = payload.role === "customer" ? Customer : User;
  const account = await Model.findById(payload.id);
  if (!account || !account.isActive) throw new ApiError(401, "Account not found or inactive");
  const tokens = generateTokens(account._id, payload.role);
  res.json({ success: true, ...tokens });
}

// GET /api/auth/me
async function me(req, res) {
  const Model = req.auth.role === "customer" ? Customer : User;
  const account = await Model.findById(req.auth.id);
  if (!account) throw new ApiError(404, "Account not found");
  res.json({ success: true, user: account, role: req.auth.role });
}

// POST /api/auth/logout (stateless — client drops tokens)
async function logout(_req, res) {
  res.json({ success: true, message: "Logged out" });
}

module.exports = { register, login, refreshToken, me, logout };
