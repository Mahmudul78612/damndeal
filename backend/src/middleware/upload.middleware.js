const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const sharp = require("sharp");

const UPLOAD_DIR = path.join(__dirname, "../../uploads");

// Ensure upload directories exist
const dirs = ["kyc", "products", "banners", "delivery", "categories", "customization", "promo", "settings", "desktop-home"];
for (const dir of dirs) {
  const p = path.join(UPLOAD_DIR, dir);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function makeStorage(subDir) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(UPLOAD_DIR, subDir));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = crypto.randomBytes(16).toString("hex") + ext;
      cb(null, name);
    },
  });
}

/**
 * Middleware: optimize uploaded images via Sharp
 * - Resize to maxWidth maintaining aspect ratio
 * - Convert to WebP with quality 80
 * - Overwrite original file
 */
function optimizeImages(maxWidth = 1200) {
  return async (req, _res, next) => {
    try {
      const files = req.files || (req.file ? [req.file] : []);
      if (files.length === 0) return next();

      await Promise.all(
        files.map(async (file) => {
          const filePath = file.path;
          const ext = path.extname(filePath).toLowerCase();
          if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return;

          const optimizedName = file.filename.replace(ext, ".webp");
          const outputPath = path.join(path.dirname(filePath), optimizedName);

          await sharp(filePath)
            .resize({ width: maxWidth, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(outputPath);

          // Remove original if different from output
          if (filePath !== outputPath) {
            fs.unlink(filePath, () => {});
          }

          // Update file reference
          file.filename = optimizedName;
          file.path = outputPath;
        })
      );
      next();
    } catch (err) {
      next(err);
    }
  };
}

const imageFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowed.test(file.mimetype.split("/")[1]);
  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
  }
};

const uploadKycPhoto = multer({
  storage: makeStorage("kyc"),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: imageFilter,
}).single("photo");

const uploadKycDocuments = multer({
  storage: makeStorage("kyc"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).fields([
  { name: "photo", maxCount: 1 },
  { name: "passbookImage", maxCount: 1 },
  { name: "gstCertificateImage", maxCount: 1 },
]);

const uploadProductImages = multer({
  storage: makeStorage("products"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).array("images", 10);

const uploadBanner = multer({
  storage: makeStorage("banners"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single("image");

const uploadDeliveryPhoto = multer({
  storage: makeStorage("delivery"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single("photo");

const uploadCategoryImage = multer({
  storage: makeStorage("categories"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single("image");

const uploadCustomizationImage = multer({
  storage: makeStorage("customization"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single("image");

const uploadPromoImages = multer({
  storage: makeStorage("promo"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).fields([
  { name: "bgImage", maxCount: 1 },
  { name: "cardImages", maxCount: 20 },
]);

const uploadSettingImage = multer({
  storage: makeStorage("settings"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
}).single("image");

const uploadDesktopBanners = multer({
  storage: makeStorage("desktop-home"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).array("images", 6);

const uploadHomeSectionBanners = multer({
  storage: makeStorage("banners"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).array("bannerImages", 20);

// CSV import (in-memory; small file)
const uploadCsvFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    if (/csv|excel|spreadsheet|text\/plain/i.test(file.mimetype) || /\.csv$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Only CSV files are allowed"));
  },
}).single("file");

module.exports = { uploadKycPhoto, uploadKycDocuments, uploadProductImages, uploadBanner, uploadDeliveryPhoto, uploadCategoryImage, uploadCustomizationImage, uploadPromoImages, uploadSettingImage, uploadDesktopBanners, uploadHomeSectionBanners, uploadCsvFile, optimizeImages, UPLOAD_DIR };
