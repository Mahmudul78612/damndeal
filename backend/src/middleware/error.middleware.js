function errorHandler(err, req, res, _next) {
  console.error("Unhandled error:", err);

  // Multer file upload errors — report the limit that actually applied
  if (err.code === "LIMIT_FILE_SIZE") {
    const limitMb = err.field && req.uploadLimitMb ? req.uploadLimitMb : null;
    return res.status(400).json({
      success: false,
      message: limitMb
        ? `File too large. Maximum ${limitMb} MB per image.`
        : "File too large. Please upload a smaller image (max 8 MB).",
    });
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
