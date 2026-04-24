const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const http = require("http");
const Product = require("../../../models/Product");
const Category = require("../../../models/Category");
const SubCategory = require("../../../models/SubCategory");

// ── Minimal RFC-4180-ish CSV parser (handles quoted fields, embedded newlines & "" escaping) ──
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* ignore */ }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h || "").trim());
  return rows.slice(1)
    .filter((r) => r.some((v) => String(v || "").trim() !== ""))
    .map((r) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = r[i] != null ? String(r[i]) : ""; });
      return o;
    });
}

// ── Strip HTML tags but keep basic formatting ──
function htmlPreserve(html) {
  // Keep useful tags; remove Amazon/Shopify junk classes
  if (!html) return "";
  return html
    .replace(/\sclass="[^"]*"/g, "")
    .replace(/\sdata-mce-fragment="[^"]*"/g, "")
    .replace(/\u00ef\u00bf\u00bd|\ufffd/g, "") // junk replacement chars
    .trim();
}

// ── Download a remote image to /uploads/products/ ──
function downloadImage(url, destDir) {
  return new Promise((resolve) => {
    try {
      if (!url || !/^https?:\/\//i.test(url)) return resolve(null);
      const lib = url.startsWith("https") ? https : http;
      const ext = (path.extname(new URL(url).pathname).split("?")[0] || ".jpg").slice(0, 5).toLowerCase() || ".jpg";
      const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
      const filename = crypto.randomBytes(16).toString("hex") + safeExt;
      const fullPath = path.join(destDir, filename);
      const file = fs.createWriteStream(fullPath);
      const req = lib.get(url, { timeout: 20000 }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close(); fs.unlink(fullPath, () => {});
          return downloadImage(res.headers.location, destDir).then(resolve);
        }
        if (res.statusCode !== 200) {
          file.close(); fs.unlink(fullPath, () => {}); return resolve(null);
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(`/uploads/products/${filename}`)));
      });
      req.on("error", () => { file.close(); fs.unlink(fullPath, () => {}); resolve(null); });
      req.on("timeout", () => { req.destroy(); file.close(); fs.unlink(fullPath, () => {}); resolve(null); });
    } catch (_) { resolve(null); }
  });
}

// ── Group Shopify CSV rows by Handle ──
function groupByHandle(rows) {
  const groups = new Map();
  let currentHandle = null;
  for (const r of rows) {
    const handle = String(r.Handle || "").trim();
    if (handle) currentHandle = handle;
    if (!currentHandle) continue;
    if (!groups.has(currentHandle)) groups.set(currentHandle, []);
    groups.get(currentHandle).push(r);
  }
  return groups;
}

function num(v) { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; }
function int(v) { const n = parseInt(String(v ?? "").replace(/,/g, ""), 10); return Number.isFinite(n) ? n : 0; }

// POST /admin/products/import-csv
async function importCsv(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "CSV file required (field name: file)" });

    const {
      categoryId,
      subCategoryId,
      platform = "damndeal",
      marginPercent = 0,         // markup over Cost per item to set sellingPrice (if not given, use CSV Variant Price)
      gstPercent = 18,
      defaultStock = 100,
      useCsvPrice = "true",       // if true, use Variant Price as sellingPrice; else use cost*(1+margin)
      downloadImages: dlFlag = "true",
    } = req.body;

    if (!categoryId) return res.status(400).json({ success: false, message: "categoryId is required" });

    const category = await Category.findById(categoryId);
    if (!category) return res.status(400).json({ success: false, message: "Invalid categoryId" });
    let subCategory = null;
    if (subCategoryId) subCategory = await SubCategory.findById(subCategoryId);

    const text = req.file.buffer.toString("utf8");
    const rows = rowsToObjects(parseCSV(text));
    if (!rows.length) return res.status(400).json({ success: false, message: "Empty CSV" });

    const groups = groupByHandle(rows);
    const destDir = path.join(__dirname, "..", "..", "..", "..", "uploads", "products");
    fs.mkdirSync(destDir, { recursive: true });

    const useCsv = String(useCsvPrice) === "true" || useCsvPrice === true;
    const doDownload = String(dlFlag) === "true" || dlFlag === true;
    const margin = num(marginPercent);

    const created = [];
    const skipped = [];
    const errors = [];

    for (const [handle, gRows] of groups.entries()) {
      try {
        const head = gRows.find((r) => String(r.Title || "").trim()) || gRows[0];
        const title = String(head.Title || "").trim();
        if (!title) { skipped.push({ handle, reason: "no title" }); continue; }

        // Skip if SKU already imported
        const sku = String(head["Variant SKU"] || handle).trim();
        const exists = await Product.findOne({ sku }).select("_id");
        if (exists) { skipped.push({ handle, reason: "sku exists", sku }); continue; }

        // Pricing
        const cost = num(head["Cost per item"]);
        const variantPrice = num(head["Variant Price"]);
        const compareAt = num(head["Variant Compare At Price"]);
        let sellingPrice = useCsv && variantPrice ? variantPrice : Math.round(cost * (1 + margin / 100));
        if (!sellingPrice) sellingPrice = variantPrice || cost || 0;
        const mrp = compareAt && compareAt > sellingPrice ? compareAt : Math.round(sellingPrice * 1.2);

        // Inventory
        const stock = head["Variant Inventory Qty"] !== "" ? int(head["Variant Inventory Qty"]) : int(defaultStock);
        // Note: Shopify "Variant Grams" is shipping/package weight, not product weight to display.
        // We intentionally don't import it onto product.weight (which is shown next to unit on PDP).

        // Images: collect Image Src across all rows in this group, in Image Position order
        const imageRows = gRows
          .filter((r) => String(r["Image Src"] || "").trim())
          .map((r) => ({ url: r["Image Src"].trim(), pos: int(r["Image Position"]) || 999 }))
          .sort((a, b) => a.pos - b.pos);
        const uniqueUrls = [...new Set(imageRows.map((r) => r.url))].slice(0, 10);

        let images = [];
        if (doDownload) {
          for (const url of uniqueUrls) {
            const local = await downloadImage(url, destDir);
            if (local) images.push(local);
          }
        } else {
          images = uniqueUrls; // store remote URLs directly
        }

        // Tags
        const tags = String(head.Tags || "")
          .split(",").map((t) => t.trim()).filter(Boolean);

        // Highlights from <li> tags in body
        const body = String(head["Body (HTML)"] || "");
        const highlights = [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
          .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
          .filter(Boolean).slice(0, 8);

        const product = await Product.create({
          platform,
          partner: req.user.userId,
          name: title,
          description: htmlPreserve(body),
          sku,
          category: category._id,
          subCategory: subCategory ? subCategory._id : null,
          images,
          costPrice: cost || sellingPrice,
          sellingPrice,
          mrp,
          gstPercent: int(gstPercent),
          gstInclusive: true,
          unit: "piece",
          stock,
          weight: null,
          tags,
          brand: (() => {
            const v = String(head.Vendor || "").trim();
            // Skip vendor if it looks like a domain (contains "." and no spaces) — that's the seller's site, not a real brand.
            if (!v || (/\./.test(v) && !/\s/.test(v))) return null;
            return v;
          })(),
          highlights,
          isActive: String(head.Status || "active").toLowerCase() === "active",
          approvalStatus: "approved",
          approvedBy: req.user.userId,
          approvedAt: new Date(),
          source: "manual",
        });

        created.push({ id: product._id, name: product.name, sku, images: images.length });
      } catch (e) {
        errors.push({ handle, error: e.message });
      }
    }

    return res.json({
      success: true,
      summary: {
        totalGroups: groups.size,
        created: created.length,
        skipped: skipped.length,
        errors: errors.length,
      },
      created, skipped, errors,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { importCsv };
