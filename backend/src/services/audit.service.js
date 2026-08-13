const AuditLog = require("../models/AuditLog");

/**
 * Record a privileged mutation.
 *
 * Auditing must never break the operation it is auditing, so every failure is
 * swallowed and logged to stderr instead of bubbling up. Call it AFTER the
 * write succeeds, and pass only the fields that changed.
 *
 *   await writeAudit(req, {
 *     action: "coupon.campaign.approve",
 *     module: "coupons",
 *     targetType: "CouponCampaign",
 *     targetId: campaign._id,
 *     targetLabel: campaign.title,
 *     before: { status: prevStatus },
 *     after: { status: campaign.status },
 *   });
 */
async function writeAudit(req, entry) {
  try {
    const ip =
      req?.headers?.["x-real-ip"] ||
      (req?.headers?.["x-forwarded-for"] || "").split(",").pop()?.trim() ||
      req?.ip ||
      "";
    await AuditLog.create({
      actor: req?.user?.userId || null,
      actorRole: req?.user?.role || "system",
      actorLabel: req?.staff?.name || req?.user?.phone || "",
      region: (req?.region || "").toUpperCase(),
      ip,
      userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 200),
      ...entry,
    });
  } catch (err) {
    console.error("[AUDIT] failed to record", entry?.action, err.message);
  }
}

/** Shallow diff limited to `keys` — keeps audit rows small and readable. */
function diff(before, after, keys) {
  const b = {}, a = {};
  for (const k of keys) {
    const bv = before?.[k];
    const av = after?.[k];
    if (JSON.stringify(bv) !== JSON.stringify(av)) { b[k] = bv; a[k] = av; }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}

module.exports = { writeAudit, diff };
