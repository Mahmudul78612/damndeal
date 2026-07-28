function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, _next) {
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({ success: false, message: `${field} already exists` });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, message: Object.values(err.errors).map((e) => e.message).join(", ") });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: `Invalid ${err.path}` });
  }
  const status = err.statusCode || 500;
  if (status === 500) console.error("[ERROR]", err);
  res.status(status).json({ success: false, message: err.message || "Server error" });
}

class ApiError extends Error {
  constructor(statusCode, message) { super(message); this.statusCode = statusCode; }
}

module.exports = { notFound, errorHandler, ApiError };
