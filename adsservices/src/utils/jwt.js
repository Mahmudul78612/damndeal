const jwt = require("jsonwebtoken");

function generateTokens(id, role) {
  const accessToken = jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRY || "30m" });
  const refreshToken = jwt.sign({ id, role }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRY || "30d" });
  return { accessToken, refreshToken };
}
const verifyAccess = (t) => jwt.verify(t, process.env.JWT_SECRET);
const verifyRefresh = (t) => jwt.verify(t, process.env.JWT_REFRESH_SECRET);

module.exports = { generateTokens, verifyAccess, verifyRefresh };
