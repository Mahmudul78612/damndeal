const { round2, sum } = require("./money");

// Recomputes all money fields on a work order from its labor + part lines.
// Mutates and returns the work order. Pull tax/fee defaults from settings.
function recalcWorkOrder(wo, settings) {
  // labor lines
  wo.laborItems.forEach((l) => {
    l.lineTotal = l.flatPrice != null && l.flatPrice !== ""
      ? round2(Number(l.flatPrice))
      : round2(Number(l.hours || 0) * Number(l.rate || 0));
  });
  // part lines
  wo.partItems.forEach((p) => {
    p.lineTotal = round2(Number(p.quantity || 0) * Number(p.sellPrice || 0));
  });

  wo.laborSubtotal = sum(wo.laborItems, (l) => l.lineTotal);
  wo.partsSubtotal = sum(wo.partItems, (p) => p.lineTotal);
  const subtotal = round2(wo.laborSubtotal + wo.partsSubtotal);

  // discount
  let discountAmount = 0;
  if (wo.discount) {
    discountAmount = wo.discountType === "percent"
      ? round2(subtotal * (Number(wo.discount) / 100))
      : round2(Number(wo.discount));
  }
  const afterDiscount = round2(subtotal - discountAmount);

  // shop supplies fee (% of labor, capped)
  const feePct = settings?.shopSuppliesFeePercent || 0;
  const feeCap = settings?.shopSuppliesFeeCap || 0;
  let fee = round2(wo.laborSubtotal * (feePct / 100));
  if (feeCap > 0) fee = Math.min(fee, feeCap);
  wo.shopSuppliesFee = fee;

  // tax — apply only to taxable lines, proportional to their share after discount
  const taxRate = wo.taxRate != null ? wo.taxRate : (settings?.taxRate || 0);
  wo.taxRate = taxRate;
  const taxableLabor = sum(wo.laborItems.filter((l) => l.taxable), (l) => l.lineTotal);
  const taxablePart = sum(wo.partItems.filter((p) => p.taxable), (p) => p.lineTotal);
  let taxableBase = round2(taxableLabor + taxablePart);
  // reduce taxable base proportionally by discount
  if (discountAmount > 0 && subtotal > 0) {
    taxableBase = round2(taxableBase * (afterDiscount / subtotal));
  }
  wo.taxAmount = round2(taxableBase * (taxRate / 100));

  wo.total = round2(afterDiscount + wo.shopSuppliesFee + wo.taxAmount);
  return wo;
}

module.exports = { recalcWorkOrder };
