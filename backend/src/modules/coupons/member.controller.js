/**
 * Merchant team accounts: invites, credentials and roles.
 *
 * A business is many people. Before this, one phone number was the whole
 * company's login, which meant sharing credentials and no way to tell who
 * redeemed what. Members are invited by the owner, set their own password,
 * and act only inside their role and scope.
 */
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const { CouponVendor } = require("../../models/coupon.models");
const { CouponOrg, CouponOutlet, CouponMember } = require("../../models/couponOrg.models");
const { COUPON_ROLES, OUTLET_SCOPED_ROLES, permissionsFor } = require("../../config/couponPermissions");
const { generateTokens } = require("../../services/token.service");
const { sendEmail } = require("../../services/email.service");
const { brandsInScope } = require("../../middleware/couponAuth.middleware");

const INVITE_TTL_DAYS = 7;
const norm = (s) => String(s || "").trim();
const normEmail = (s) => norm(s).toLowerCase();

/* ── Team management (owner / manage_members) ─────────────────────────────── */

/* GET /api/coupons/business/members */
async function listMembers(req, res) {
  const orgId = req.couponMember.org;
  if (!orgId) return res.json({ success: true, members: [] });
  const members = await CouponMember.find({ org: orgId })
    .select("-inviteToken")
    .sort({ createdAt: 1 })
    .lean();
  return res.json({ success: true, members, roles: Object.entries(COUPON_ROLES).map(([key, v]) => ({ key, label: v.label })) });
}

/* POST /api/coupons/business/members — invite someone */
async function inviteMember(req, res) {
  const orgId = req.couponMember.org;
  if (!orgId) return res.status(400).json({ success: false, message: "Your business is not set up yet." });

  const name = norm(req.body.name);
  const email = normEmail(req.body.email);
  const phone = norm(req.body.phone);
  const role = norm(req.body.role) || "cashier";
  const outlets = Array.isArray(req.body.outlets) ? req.body.outlets : [];
  const brands = Array.isArray(req.body.brands) ? req.body.brands : [];

  if (!name) return res.status(400).json({ success: false, message: "Name is required" });
  if (!email && !phone) return res.status(400).json({ success: false, message: "Enter an email or a phone number" });
  if (!COUPON_ROLES[role]) return res.status(400).json({ success: false, message: "Unknown role" });
  if (role === "owner") return res.status(400).json({ success: false, message: "There can only be one owner. Use Manager instead." });
  if (OUTLET_SCOPED_ROLES.has(role) && !outlets.length) {
    return res.status(400).json({ success: false, message: "A cashier must be assigned to at least one outlet." });
  }

  // Outlets and brands must belong to this org — never trust ids from the client
  if (outlets.length) {
    const ok = await CouponOutlet.countDocuments({ _id: { $in: outlets }, org: orgId });
    if (ok !== outlets.length) return res.status(400).json({ success: false, message: "One of those outlets is not yours." });
  }
  if (brands.length) {
    const ok = await CouponVendor.countDocuments({ _id: { $in: brands }, org: orgId });
    if (ok !== brands.length) return res.status(400).json({ success: false, message: "One of those brands is not yours." });
  }

  const dupe = await CouponMember.findOne({
    org: orgId,
    $or: [email ? { email } : null, phone ? { phone } : null].filter(Boolean),
  }).lean();
  if (dupe) return res.status(409).json({ success: false, message: "That person is already on your team." });

  const token = crypto.randomBytes(24).toString("hex");
  const member = await CouponMember.create({
    org: orgId, name, email, phone, role,
    scope: { brands, outlets },
    status: "invited",
    inviteToken: token,
    inviteExpiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86400000),
    invitedBy: req.user.userId,
  });

  const org = await CouponOrg.findById(orgId).select("name").lean();
  const base = req.headers.origin || (req.region === "US" ? "https://coupon.damndeal.com" : "https://coupon.damndeal.in");
  const link = `${base}/business/join?token=${token}`;

  if (email) {
    sendEmail(
      email,
      `You have been invited to ${org?.name || "a business"} on DamnDeal`,
      `<p>Hi ${name},</p>
       <p><b>${org?.name || "A business"}</b> has invited you to join their DamnDeal coupon account
          as <b>${COUPON_ROLES[role].label.split(" — ")[0]}</b>.</p>
       <p><a href="${link}" style="background:#7C3AED;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Accept the invitation</a></p>
       <p style="color:#666;font-size:13px">This link expires in ${INVITE_TTL_DAYS} days.</p>`
    ).catch((e) => console.error("[INVITE] email failed:", e.message));
  }

  return res.status(201).json({
    success: true,
    member: { ...member.toObject(), inviteToken: undefined },
    inviteLink: link,   // shown in the portal so the owner can share it directly
  });
}

/* PUT /api/coupons/business/members/:id */
async function updateMember(req, res) {
  const orgId = req.couponMember.org;
  const member = await CouponMember.findOne({ _id: req.params.id, org: orgId });
  if (!member) return res.status(404).json({ success: false, message: "Team member not found" });
  if (member.role === "owner") return res.status(400).json({ success: false, message: "The owner cannot be changed here." });

  const { role, outlets, brands, status, name } = req.body;
  if (name) member.name = norm(name);
  if (role) {
    if (!COUPON_ROLES[role] || role === "owner") return res.status(400).json({ success: false, message: "Unknown role" });
    member.role = role;
  }
  if (Array.isArray(outlets)) {
    if (outlets.length) {
      const ok = await CouponOutlet.countDocuments({ _id: { $in: outlets }, org: orgId });
      if (ok !== outlets.length) return res.status(400).json({ success: false, message: "One of those outlets is not yours." });
    }
    member.scope.outlets = outlets;
  }
  if (Array.isArray(brands)) member.scope.brands = brands;
  if (status && ["active", "disabled"].includes(status)) member.status = status;

  if (OUTLET_SCOPED_ROLES.has(member.role) && !member.scope.outlets.length) {
    return res.status(400).json({ success: false, message: "A cashier must be assigned to at least one outlet." });
  }

  await member.save();
  return res.json({ success: true, member: { ...member.toObject(), inviteToken: undefined } });
}

/* DELETE /api/coupons/business/members/:id */
async function removeMember(req, res) {
  const orgId = req.couponMember.org;
  const member = await CouponMember.findOne({ _id: req.params.id, org: orgId });
  if (!member) return res.status(404).json({ success: false, message: "Team member not found" });
  if (member.role === "owner") return res.status(400).json({ success: false, message: "The owner cannot be removed." });
  await member.deleteOne();
  return res.json({ success: true, message: "Removed from the team" });
}

/* ── Invite acceptance + credentials (public) ─────────────────────────────── */

/* GET /api/coupons/business/invite/:token — what am I being invited to? */
async function inviteInfo(req, res) {
  const member = await CouponMember.findOne({ inviteToken: req.params.token }).lean();
  if (!member) return res.status(404).json({ success: false, message: "This invitation link is not valid." });
  if (member.inviteExpiresAt && member.inviteExpiresAt < new Date()) {
    return res.status(410).json({ success: false, message: "This invitation has expired — ask for a new one." });
  }
  const org = await CouponOrg.findById(member.org).select("name").lean();
  return res.json({
    success: true,
    invite: {
      name: member.name, email: member.email, phone: member.phone,
      role: member.role, roleLabel: COUPON_ROLES[member.role]?.label || member.role,
      business: org?.name || "",
    },
  });
}

/* POST /api/coupons/business/invite/:token/accept { password } */
async function acceptInvite(req, res) {
  const password = String(req.body.password || "");
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: "Choose a password of at least 8 characters." });
  }
  const member = await CouponMember.findOne({ inviteToken: req.params.token });
  if (!member) return res.status(404).json({ success: false, message: "This invitation link is not valid." });
  if (member.inviteExpiresAt && member.inviteExpiresAt < new Date()) {
    return res.status(410).json({ success: false, message: "This invitation has expired — ask for a new one." });
  }

  // Reuse an existing account when the phone/email already belongs to one,
  // so a shopper who is also a cashier keeps a single identity.
  let user = null;
  if (member.phone) user = await User.findOne({ phone: member.phone, role: "user" });
  if (!user && member.email) user = await User.findOne({ email: member.email, role: "user" });
  if (!user) {
    user = await User.create({
      phone: member.phone || `member-${member._id}`,
      email: member.email || null,
      name: member.name,
      role: "user",
      isProfileComplete: true,
    });
  }

  member.user = user._id;
  member.passwordHash = await bcrypt.hash(password, 10);
  member.status = "active";
  member.inviteToken = null;
  member.inviteExpiresAt = null;
  await member.save();

  const tokens = generateTokens(user._id, user.role);
  return res.json({
    success: true,
    ...tokens,
    member: memberSession(member),
  });
}

/* POST /api/coupons/business/login { email, password } */
async function login(req, res) {
  const email = normEmail(req.body.email);
  const password = String(req.body.password || "");
  if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required" });

  const member = await CouponMember.findOne({ email, status: "active" }).select("+passwordHash");
  // Same message either way — never reveal which emails exist.
  const bad = () => res.status(401).json({ success: false, message: "Wrong email or password" });
  if (!member || !member.passwordHash) return bad();
  if (!(await bcrypt.compare(password, member.passwordHash))) return bad();

  const org = await CouponOrg.findById(member.org).lean();
  if (!org || org.status === "suspended") {
    return res.status(403).json({ success: false, message: "This business account is suspended." });
  }

  member.lastLoginAt = new Date();
  await member.save();

  if (!member.user) return bad();
  const tokens = generateTokens(member.user, "user");
  return res.json({ success: true, ...tokens, member: memberSession(member), business: { id: org._id, name: org.name } });
}

/* POST /api/coupons/business/set-password { password } — authenticated */
async function setPassword(req, res) {
  const password = String(req.body.password || "");
  if (password.length < 8) return res.status(400).json({ success: false, message: "Choose a password of at least 8 characters." });
  const member = await CouponMember.findById(req.couponMember._id);
  if (!member) return res.status(404).json({ success: false, message: "No team account found" });
  member.passwordHash = await bcrypt.hash(password, 10);
  await member.save();
  return res.json({ success: true, message: "Password updated" });
}

/* GET /api/coupons/business/me — session + permissions (drives the portal menu) */
async function me(req, res) {
  const m = req.couponMember;
  if (!m) return res.json({ success: true, member: null });
  const [org, brands, outlets] = await Promise.all([
    m.org ? CouponOrg.findById(m.org).select("name region plan status").lean() : null,
    CouponVendor.find(m.org ? { org: m.org } : { user: m.user }).select("businessName slug logo").lean(),
    m.scope?.outlets?.length
      ? CouponOutlet.find({ _id: { $in: m.scope.outlets } }).select("name city").lean()
      : (m.org ? CouponOutlet.find({ org: m.org }).select("name city brand").lean() : []),
  ]);
  const inScope = await brandsInScope(req);
  return res.json({
    success: true,
    member: {
      id: m._id, name: m.name, role: m.role, legacy: !!m.legacy,
      permissions: req.couponPerms || [],
      scope: { brands: m.scope?.brands || [], outlets: m.scope?.outlets || [] },
    },
    business: org,
    brands: brands.filter((b) => inScope.includes(String(b._id))),
    outlets,
  });
}

function memberSession(member) {
  return {
    id: member._id, name: member.name, role: member.role,
    permissions: permissionsFor(member.role),
    scope: member.scope,
  };
}

module.exports = {
  listMembers, inviteMember, updateMember, removeMember,
  inviteInfo, acceptInvite, login, setPassword, me,
};
