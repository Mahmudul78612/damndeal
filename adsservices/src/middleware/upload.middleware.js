const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const UPLOAD_DIR = path.join(__dirname, "../../uploads");
for (const d of ["ads", "thumbs"]) {
  const p = path.join(UPLOAD_DIR, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function storage(sub) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(UPLOAD_DIR, sub)),
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString("hex") + path.extname(file.originalname).toLowerCase()),
  });
}

// Accept images (banner) and videos (video ad) + optional poster image.
const creativeFilter = (_req, file, cb) => {
  const ok = /image\/(jpeg|jpg|png|gif|webp)|video\/(mp4|webm|ogg|quicktime)/.test(file.mimetype);
  cb(ok ? null : new Error("Only images and videos are allowed"), ok);
};

const uploadAd = multer({
  storage: storage("ads"),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB (videos)
  fileFilter: creativeFilter,
}).fields([
  { name: "creative", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

module.exports = { uploadAd, UPLOAD_DIR };
