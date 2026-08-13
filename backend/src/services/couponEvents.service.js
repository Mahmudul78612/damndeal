// Coupon event recording — must never slow down or break a request.
//
// Design:
//   track()       buffers an event in memory; the buffer is flushed with one
//                 insertMany every FLUSH_MS (or when it gets large). A request
//                 never waits for the database.
//   impressions() counts campaign appearances in a Redis hash per day instead
//                 of writing a row per coupon per page view — a home render
//                 shows ~20 coupons and we only ever read impressions as a
//                 total.
//   rollupDay()   folds yesterday's events + Redis impressions into
//                 CouponDailyStat, which is what dashboards read.
//
// Every function swallows its own errors on purpose: losing an analytics
// event is acceptable, failing a customer's claim is not.
const { CouponEvent, CouponDailyStat } = require("../models/couponAnalytics.models");
const { getRedisClient } = require("./otp.service");

const FLUSH_MS = 5000;
const MAX_BUFFER = 500;

let buffer = [];
let timer = null;

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

async function flush() {
  if (!buffer.length) return;
  const batch = buffer;
  buffer = [];
  try {
    await CouponEvent.insertMany(batch, { ordered: false });
  } catch (err) {
    console.error("[EVENTS] flush failed:", err.message);
  }
}

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flush(); }, FLUSH_MS);
  if (timer.unref) timer.unref();
}

/** Record one meaningful action. Fire-and-forget — never await this. */
function track(type, { campaign, vendor, user, region, source } = {}) {
  if (!campaign) return;
  try {
    buffer.push({
      type,
      campaign,
      vendor: vendor || null,
      user: user || null,
      region: region === "US" ? "US" : "IN",
      source: source || "",
      at: new Date(),
    });
    if (buffer.length >= MAX_BUFFER) flush();
    else scheduleFlush();
  } catch (err) {
    console.error("[EVENTS] track failed:", err.message);
  }
}

/** Count that these campaigns were shown in a listing. Cheap, aggregate-only. */
async function impressions(campaignIds, region) {
  if (!Array.isArray(campaignIds) || !campaignIds.length) return;
  try {
    const redis = await getRedisClient();
    const key = `cpn_imp:${dayKey()}:${region === "US" ? "US" : "IN"}`;
    const multi = redis.multi();
    for (const id of campaignIds.slice(0, 60)) multi.hIncrBy(key, String(id), 1);
    multi.expire(key, 60 * 60 * 72); // survives a missed rollup, then self-cleans
    await multi.exec();
  } catch (err) {
    // Redis down must not affect the page
    console.error("[EVENTS] impressions failed:", err.message);
  }
}

/**
 * Fold one day of raw events + impression counters into CouponDailyStat.
 * Idempotent: re-running for the same day overwrites that day's row.
 */
async function rollupDay(dateStr) {
  const date = dateStr || dayKey(new Date(Date.now() - 86400000)); // default: yesterday
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);

  const grouped = await CouponEvent.aggregate([
    { $match: { at: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { campaign: "$campaign", vendor: "$vendor", region: "$region" },
        views: { $sum: { $cond: [{ $eq: ["$type", "view"] }, 1, 0] } },
        clicks: { $sum: { $cond: [{ $eq: ["$type", "click"] }, 1, 0] } },
        claims: { $sum: { $cond: [{ $eq: ["$type", "claim"] }, 1, 0] } },
        redemptions: { $sum: { $cond: [{ $eq: ["$type", "redeem"] }, 1, 0] } },
      },
    },
  ]);

  // Impressions live in Redis, one hash per region per day
  const impByCampaign = {};
  try {
    const redis = await getRedisClient();
    for (const region of ["IN", "US"]) {
      const hash = await redis.hGetAll(`cpn_imp:${date}:${region}`);
      for (const [id, n] of Object.entries(hash || {})) {
        impByCampaign[id] = (impByCampaign[id] || 0) + (parseInt(n, 10) || 0);
      }
    }
  } catch (err) {
    console.error("[EVENTS] impression read failed:", err.message);
  }

  const seen = new Set();
  const ops = [];
  for (const g of grouped) {
    const id = String(g._id.campaign);
    seen.add(id);
    ops.push({
      updateOne: {
        filter: { campaign: g._id.campaign, date },
        update: {
          $set: {
            vendor: g._id.vendor || null,
            region: g._id.region || "IN",
            views: g.views, clicks: g.clicks, claims: g.claims, redemptions: g.redemptions,
            impressions: impByCampaign[id] || 0,
          },
        },
        upsert: true,
      },
    });
  }
  // Campaigns that were only shown (impressions) but got no interaction
  for (const [id, n] of Object.entries(impByCampaign)) {
    if (seen.has(id)) continue;
    ops.push({
      updateOne: {
        filter: { campaign: id, date },
        update: { $set: { impressions: n }, $setOnInsert: { views: 0, clicks: 0, claims: 0, redemptions: 0 } },
        upsert: true,
      },
    });
  }

  if (ops.length) await CouponDailyStat.bulkWrite(ops, { ordered: false });
  console.log(`[EVENTS] rollup ${date}: ${ops.length} campaign rows`);
  return { date, rows: ops.length };
}

module.exports = { track, impressions, rollupDay, flush, dayKey };
