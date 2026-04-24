const PDFDocument = require("pdfkit");
const Order = require("../models/Order");
const PartnerKyc = require("../models/PartnerKyc");

/**
 * Generate invoice PDF for an order
 * Returns a readable stream (PDFDocument)
 */
async function generateInvoice(orderId) {
  const order = await Order.findById(orderId)
    .populate("user", "name phone")
    .populate("partner", "name phone")
    .populate("items.product", "name gstPercent hsnCode")
    .lean();

  if (!order) throw new Error("Order not found");

  const kyc = await PartnerKyc.findOne({ partner: order.partner._id }).lean();

  const doc = new PDFDocument({ size: "A4", margin: 50 });

  // --- Header ---
  doc.fontSize(20).text("TAX INVOICE", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Invoice No: INV-${order.orderNumber}`, { align: "right" });
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`, { align: "right" });
  doc.moveDown();

  // --- Seller details ---
  doc.fontSize(12).text("Sold By:", { underline: true });
  doc.fontSize(10);
  doc.text(kyc?.orgName || kyc?.name || "Partner");
  if (kyc?.gstNumber) doc.text(`GSTIN: ${kyc.gstNumber}`);
  if (kyc?.shopAddress) doc.text(kyc.shopAddress);
  if (kyc?.city) doc.text(`${kyc.city}, ${kyc.state} - ${kyc.pincode}`);
  doc.moveDown();

  // --- Buyer details ---
  doc.fontSize(12).text("Bill To:", { underline: true });
  doc.fontSize(10);
  doc.text(order.user?.name || "Customer");
  doc.text(`Phone: ${order.user?.phone || "N/A"}`);
  if (order.deliveryAddress) {
    const addr = order.deliveryAddress;
    doc.text(`${addr.address || ""}`);
    doc.text(`${addr.city || ""} ${addr.state || ""} ${addr.pincode || ""}`);
  }
  doc.moveDown();

  // --- Items table ---
  const tableTop = doc.y;
  const colX = { sno: 50, name: 80, hsn: 250, qty: 310, rate: 360, gst: 420, amount: 480 };

  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("#", colX.sno, tableTop);
  doc.text("Item", colX.name, tableTop);
  doc.text("HSN", colX.hsn, tableTop);
  doc.text("Qty", colX.qty, tableTop);
  doc.text("Rate", colX.rate, tableTop);
  doc.text("GST%", colX.gst, tableTop);
  doc.text("Amount", colX.amount, tableTop);

  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
  doc.font("Helvetica").fontSize(9);

  let y = tableTop + 20;
  (order.items || []).forEach((item, i) => {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    const product = item.product || {};
    const lineTotal = (item.price || 0) * (item.quantity || 1);
    doc.text(String(i + 1), colX.sno, y);
    doc.text((product.name || item.name || "").substring(0, 25), colX.name, y);
    doc.text(product.hsnCode || "-", colX.hsn, y);
    doc.text(String(item.quantity || 1), colX.qty, y);
    doc.text(`₹${(item.price || 0).toFixed(2)}`, colX.rate, y);
    doc.text(`${product.gstPercent || 0}%`, colX.gst, y);
    doc.text(`₹${lineTotal.toFixed(2)}`, colX.amount, y);
    y += 18;
  });

  doc.moveTo(50, y).lineTo(550, y).stroke();
  y += 10;

  // --- Totals ---
  const rightCol = 420;
  doc.fontSize(10);
  doc.text("Subtotal:", rightCol, y);
  doc.text(`₹${(order.subtotal || 0).toFixed(2)}`, colX.amount, y);
  y += 16;

  if (order.totalGst) {
    doc.text("GST:", rightCol, y);
    doc.text(`₹${order.totalGst.toFixed(2)}`, colX.amount, y);
    y += 16;
  }

  if (order.deliveryFee) {
    doc.text("Delivery Fee:", rightCol, y);
    doc.text(`₹${order.deliveryFee.toFixed(2)}`, colX.amount, y);
    y += 16;
  }

  if (order.couponDiscount) {
    doc.text("Coupon Discount:", rightCol, y);
    doc.text(`-₹${order.couponDiscount.toFixed(2)}`, colX.amount, y);
    y += 16;
  }

  if (order.walletDeducted) {
    doc.text("Wallet:", rightCol, y);
    doc.text(`-₹${order.walletDeducted.toFixed(2)}`, colX.amount, y);
    y += 16;
  }

  doc.font("Helvetica-Bold");
  doc.text("Grand Total:", rightCol, y);
  doc.text(`₹${(order.grandTotal || 0).toFixed(2)}`, colX.amount, y);
  y += 20;

  doc.font("Helvetica").fontSize(8);
  doc.text(`Payment: ${order.paymentMethod || "N/A"} | Status: ${order.paymentStatus || "N/A"}`, 50, y);
  y += 20;
  doc.text("This is a computer-generated invoice and does not require a signature.", 50, y, { align: "center" });

  doc.end();
  return doc;
}

module.exports = { generateInvoice };
