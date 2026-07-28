const AdminUser = require("../../models/AdminUser");
const Advertiser = require("../../models/Advertiser");
const Publisher = require("../../models/Publisher");
const { generateTokens, verifyRefresh } = require("../../utils/jwt");
const { ApiError } = require("../../middleware/error.middleware");

// x-client-type: advertiser => Advertiser, publisher => Publisher, else AdminUser
function principalModel(req) {
  const t = (req.headers["x-client-type"] || "").toLowerCase();
  if (t === "advertiser") return Advertiser;
  if (t === "publisher") return Publisher;
  return AdminUser;
}
function modelForRole(role) {
  if (role === "advertiser") return Advertiser;
  if (role === "publisher") return Publisher;
  return AdminUser;
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, "email and password are required");

  const Model = principalModel(req);
  const account = await Model.findOne({ email: email.toLowerCase() });
  if (!account || !account.isActive) throw new ApiError(401, "Invalid credentials");
  const ok = await account.checkPassword(password);
  if (!ok) throw new ApiError(401, "Invalid credentials");

  const role = Model === Advertiser ? "advertiser" : Model === Publisher ? "publisher" : account.role;
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
  try { payload = verifyRefresh(refreshToken); } catch { throw new ApiError(401, "Invalid refresh token"); }
  const Model = modelForRole(payload.role);
  const account = await Model.findById(payload.id);
  if (!account || !account.isActive) throw new ApiError(401, "Account not found or inactive");
  res.json({ success: true, ...generateTokens(account._id, payload.role) });
}

// GET /api/auth/me
async function me(req, res) {
  const Model = modelForRole(req.auth.role);
  const account = await Model.findById(req.auth.id);
  if (!account) throw new ApiError(404, "Account not found");
  res.json({ success: true, user: account, role: req.auth.role });
}

async function logout(_req, res) { res.json({ success: true, message: "Logged out" }); }

module.exports = { login, refreshToken, me, logout };
