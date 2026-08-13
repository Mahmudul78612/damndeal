/**
 * Coupon pack invoice PDF.
 *
 * Streamed straight to the response with pdfkit (already a dependency) so no
 * file ever has to be written to disk or cleaned up. Indian merchants need a
 * GST invoice to expense this, which is why the org's legal name and tax id
 * are printed when they are on file.
 */
const PDFDocument = require("pdfkit");

const INK = "#1B1530";
const MUTED = "#6b7280";
const BRAND = "#7C3AED";

function renderInvoicePdf(res, { order, vendor, org }) {
  const sym = order.currency === "USD" ? "$" : "Rs.";
  const money = (n) => `${sym}${Number(n || 0).toFixed(2)}`;

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${order.invoiceNumber || "invoice"}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fillColor(BRAND).fontSize(22).font("Helvetica-Bold").text("DamnDeal", 48, 48);
  doc.fillColor(MUTED).fontSize(9).font("Helvetica")
    .text(order.region === "US" ? "damndeal.com" : "damndeal.in", 48, 74);

  doc.fillColor(INK).fontSize(16).font("Helvetica-Bold").text("TAX INVOICE", 0, 48, { align: "right" });
  doc.fillColor(MUTED).fontSize(9).font("Helvetica")
    .text(order.invoiceNumber || "—", 0, 70, { align: "right" })
    .text(new Date(order.paidAt || order.createdAt).toLocaleDateString(), 0, 83, { align: "right" });

  doc.moveTo(48, 108).lineTo(547, 108).strokeColor("#e5e7eb").stroke();

  // Billed to
  doc.fillColor(MUTED).fontSize(9).font("Helvetica-Bold").text("BILLED TO", 48, 124);
  doc.fillColor(INK).fontSize(12).font("Helvetica-Bold")
    .text(org?.legalName || org?.name || vendor?.businessName || "Customer", 48, 138);
  doc.fillColor(MUTED).fontSize(9.5).font("Helvetica");
  let y = 155;
  if (vendor?.businessName && org?.name && vendor.businessName !== org.name) {
    doc.text(`Brand: ${vendor.businessName}`, 48, y); y += 13;
  }
  if (org?.taxId) { doc.text(`Tax ID / GSTIN: ${org.taxId}`, 48, y); y += 13; }
  if (vendor?.address) { doc.text(vendor.address, 48, y, { width: 260 }); y += 13; }
  const contact = org?.billingEmail || vendor?.email;
  if (contact) { doc.text(contact, 48, y); y += 13; }

  // Line items table
  const top = Math.max(y + 18, 210);
  doc.rect(48, top, 499, 26).fillColor("#F4F0FB").fill();
  doc.fillColor(MUTED).fontSize(9).font("Helvetica-Bold")
    .text("DESCRIPTION", 58, top + 9)
    .text("QTY", 350, top + 9, { width: 50, align: "right" })
    .text("AMOUNT", 440, top + 9, { width: 97, align: "right" });

  const rowY = top + 34;
  doc.fillColor(INK).fontSize(10.5).font("Helvetica")
    .text(`Coupon claim credits${order.category?.name ? ` — ${order.category.name}` : ""}`, 58, rowY, { width: 280 })
    .text(String(order.claims), 350, rowY, { width: 50, align: "right" })
    .text(money(order.price), 440, rowY, { width: 97, align: "right" });

  doc.moveTo(48, rowY + 26).lineTo(547, rowY + 26).strokeColor("#e5e7eb").stroke();

  // Totals
  let ty = rowY + 38;
  const line = (label, value, bold = false) => {
    doc.fillColor(bold ? INK : MUTED).fontSize(bold ? 12 : 10)
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .text(label, 330, ty, { width: 110, align: "right" })
      .text(value, 440, ty, { width: 97, align: "right" });
    ty += bold ? 20 : 16;
  };
  line("Subtotal", money(order.price));
  if (order.taxAmount) line(`Tax (${order.taxPercent}%)`, money(order.taxAmount));
  doc.moveTo(330, ty).lineTo(547, ty).strokeColor("#e5e7eb").stroke();
  ty += 8;
  line("Total paid", money(order.totalAmount || order.price), true);

  // Payment details
  ty += 12;
  doc.fillColor(MUTED).fontSize(9).font("Helvetica")
    .text(`Paid via ${order.gateway || "manual"}${order.gatewayPaymentId ? ` · ${order.gatewayPaymentId}` : ""}`, 48, ty)
    .text(`Status: PAID`, 48, ty + 13);

  // Footer
  doc.fillColor(MUTED).fontSize(8.5).font("Helvetica")
    .text(
      "This is a computer-generated invoice and does not require a signature.",
      48, 760, { width: 499, align: "center" }
    );

  doc.end();
}

module.exports = { renderInvoicePdf };
