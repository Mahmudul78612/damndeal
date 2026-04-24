function errorHandler(err, req, res, _next) {
  console.error("Unhandled error:", err);

  // Multer file upload errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: "File too large. Max 5MB per file." });
  }
  if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ success: false, message: "Too many files uploaded." });
  }
  if (err.message === "Only image files are allowed!") {
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: "Duplicate entry" });
  }

  return res.status(500).json({ success: false, message: "Internal server error" });
}

module.exports = { errorHandler };
