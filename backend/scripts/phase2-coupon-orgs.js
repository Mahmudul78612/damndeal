#!/usr/bin/env node
/**
 * Phase 2 migration — give every existing brand a company and a first outlet.
 *
 *   node scripts/phase2-coupon-orgs.js --dry-run
 *   node scripts/phase2-coupon-orgs.js
 *
 * For each CouponVendor that has no org yet:
 *   1. CouponOrg      named after the business, owned by the vendor's user
 *   2. CouponMember   that user, role "owner", active
 *   3. CouponOutlet   "Main" — the vendor's existing address becomes its
 *                     first physical location (this is why the legacy
 *                     address fields on CouponVendor are kept, not deleted)
 *   4. vendor.org set
 * Then campaigns and claims are backfilled with org, and campaigns get
 * scope "all_outlets" so they behave exactly as before.
 *
 * Reversible: nothing is deleted, so rolling back is simply ignoring the new
 * refs. Safe to re-run — every step skips what already exists.
 */
require("dotenv").config();
const mongoose = require("mongoose");

const DRY = process.argv.includes("--dry-run");
const tag = DRY ? "[dry-run]" : "[migrate]";
const log = (...a) => console.log(tag, ...a);

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const { CouponVendor, CouponCampaign, CouponClaim } = require("../src/models/coupon.models");
  const { CouponOrg, CouponOutlet, CouponMember } = require("../src/models/couponOrg.models");

  const vendors = await CouponVendor.find({ $or: [{ org: null }, { org: { $exists: false } }] }).lean();
  log(`vendors needing an org: ${vendors.length}`);

  let orgs = 0, members = 0, outlets = 0;

  for (const v of vendors) {
    const region = Array.isArray(v.regions) && v.regions.length ? v.regions[0] : "IN";
    log(`  "${v.businessName}" → org + owner + Main outlet (${v.city || v.state || "no address"})`);
    if (DRY) { orgs++; members++; outlets++; continue; }

    const org = await CouponOrg.create({
      name: v.businessName,
      legalName: v.businessName,
      billingEmail: v.email || "",
      billingPhone: v.phone || "",
      ownerUser: v.user,
      region,
      status: v.status === "suspended" ? "suspended" : "active",
    });
    orgs++;

    await CouponMember.create({
      org: org._id,
      user: v.user,
      name: v.businessName,
      email: v.email || "",
      phone: v.phone || "",
      role: "owner",
      status: "active",
    });
    members++;

    const outletDoc = {
      org: org._id,
      brand: v._id,
      name: "Main",
      address: v.address || "",
      state: v.state || "",
      city: v.city || "",
      phone: v.phone || "",
      isActive: true,
    };
    if (Number.isFinite(v.lat) && Number.isFinite(v.lng)) {
      outletDoc.point = { type: "Point", coordinates: [v.lng, v.lat] };
    }
    await CouponOutlet.create(outletDoc);
    outlets++;

    await CouponVendor.updateOne({ _id: v._id }, { $set: { org: org._id } });
  }

  // Backfill campaigns + claims with their org, and give campaigns a scope
  let campaignsTouched = 0, claimsTouched = 0;
  const allVendors = await CouponVendor.find({ org: { $ne: null } }).select("_id org").lean();
  for (const v of allVendors) {
    if (DRY) {
      campaignsTouched += await CouponCampaign.countDocuments({ vendor: v._id, $or: [{ org: null }, { org: { $exists: false } }] });
      claimsTouched += await CouponClaim.countDocuments({ vendor: v._id, $or: [{ org: null }, { org: { $exists: false } }] });
      continue;
    }
    const c = await CouponCampaign.updateMany(
      { vendor: v._id, $or: [{ org: null }, { org: { $exists: false } }] },
      { $set: { org: v.org } }
    );
    campaignsTouched += c.modifiedCount || 0;
    const cl = await CouponClaim.updateMany(
      { vendor: v._id, $or: [{ org: null }, { org: { $exists: false } }] },
      { $set: { org: v.org } }
    );
    claimsTouched += cl.modifiedCount || 0;
  }
  if (!DRY) {
    // Existing campaigns keep their hand-entered targeting; scope only records
    // that they apply to the whole brand. deriveLocation is NOT run here —
    // rewriting live targeting during a migration is exactly the kind of
    // surprise this phase must avoid.
    const s = await CouponCampaign.updateMany({ scope: { $exists: false } }, { $set: { scope: "all_outlets" } });
    log(`campaigns given a default scope: ${s.modifiedCount || 0}`);
  }

  log(`orgs: ${orgs} · members: ${members} · outlets: ${outlets}`);
  log(`campaigns backfilled: ${campaignsTouched} · claims backfilled: ${claimsTouched}`);

  if (!DRY) {
    await CouponOutlet.collection.createIndex({ brand: 1, isActive: 1 });
    await CouponOutlet.collection.createIndex({ point: "2dsphere" }, { sparse: true });
    await CouponCampaign.collection.createIndex({ "location.outletPoints": "2dsphere" }, { sparse: true });
    log("indexes created");
  }

  log("done");
  process.exit(0);
})().catch((e) => {
  console.error("[migrate] FAILED:", e);
  process.exit(1);
});
