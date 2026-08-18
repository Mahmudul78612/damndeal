# AGENTS.md — Instructions for AI Coding Assistants

> This file is read by AI agents (Claude, GitHub Copilot, Cursor, etc.)
> when working in this repo. It explains the project so the agent can help
> a new developer set up and modify the codebase without asking obvious
> questions.

---

## 🎯 Project Overview

A **white-label e-commerce + quick-commerce platform**. Multi-frontend
architecture sharing one Node.js/Express + MongoDB backend.

| Folder | Stack | Purpose | Default Port |
|---|---|---|---|
| `backend/` | Node 20, Express 4, Mongoose 8, Redis | REST API + Socket.IO | 5000 |
| `admin/` | Vanilla HTML/JS/CSS (no build step) | Admin panel | served by nginx (or `npx serve admin`) |
| `web/` | Next.js 16 (App Router, TypeScript) | Customer storefront | 3000 |
| `partnerportal/` | Next.js | Vendor/partner dashboard | 3001 |
| `userapp/` | Flutter | Customer mobile app | — |
| `partnerapp/` | Flutter | Vendor mobile app | — |
| `deliveryapp/` | Flutter | Delivery boy app | — |

**Two storefronts in one DB** — distinguished by `platform` enum:
- `"damndeal"` → online store (full e-commerce, slower delivery)
- `"ddgo"` → quick commerce (10-min delivery)

> ⚠️ The strings `"damndeal"` and `"ddgo"` are **DB enum values** — DO NOT
> rename them. User-facing labels were renamed to "Online Store" and
> "Quick Commerce" but the enum keys stay.

---

## 🏗️ Backend Architecture

```
backend/src/
├── server.js                           # entry: express + socket.io + cron
├── config/                             # db, redis connections
├── middleware/                         # auth, error handler, rate limits
├── models/                             # mongoose schemas
├── modules/
│   ├── admin/                          # admin endpoints (controllers + routes)
│   ├── user/                           # customer endpoints
│   ├── partner/                        # vendor endpoints
│   └── delivery/                       # delivery boy endpoints
├── services/
│   ├── fee.service.js                  # AppSettings reader (auto-decrypts)
│   ├── notification.service.js         # Fast2SMS WhatsApp sender
│   ├── delhivery.service.js            # courier (Delhivery API)
│   ├── fship.service.js                # courier (Shiprocket API)
│   └── payment.service.js              # Razorpay
├── utils/
│   └── secrets.js                      # ★ AES-256-GCM encrypt/decrypt
└── scripts/                            # one-off migrations (not auto-run)
```

### Key conventions

- **Settings storage:** All runtime config (API keys, branding, fees, etc.)
  is stored in the `appsettings` MongoDB collection. Backend code reads via
  `feeService.getSetting(key)` / `getSettings([keys])` which auto-decrypts.
- **Sensitive keys** (listed in `utils/secrets.js` `SECRET_KEYS` Set) are
  encrypted at rest with AES-256-GCM. Envelope: `enc:v1:<iv>:<tag>:<ct>` (b64).
  Master key from `process.env.SETTINGS_ENCRYPTION_KEY` (64-hex / 32 bytes).
- **Auth:** Phone + OTP. JWT access (15m) + refresh (30d). Admin phones
  whitelisted via `ADMIN_PHONES` env. Test bypass: `TEST_PHONES` + `TEST_OTP`.
- **No TypeScript on backend.** CommonJS (`require`).
- **Errors:** Throw `{ status: 4xx, message: "..." }` style — caught by global error handler.

---

## 🔐 Encryption Module — `backend/src/utils/secrets.js`

```js
const secrets = require("./utils/secrets");

secrets.SECRET_KEYS              // Set of keys that should be encrypted
secrets.isSecretKey(key)         // boolean
secrets.isEncrypted(value)       // detects "enc:v1:..." prefix
secrets.encrypt(plain)           // returns "enc:v1:..."
secrets.decrypt(envelope)        // returns plain string (or original if not encrypted)
secrets.encryptSetting(key, val) // encrypt only if key is sensitive
secrets.decryptSetting(key, val) // decrypt only if value is encrypted
secrets.mask(plain)              // "••••XXXX" (last 4 chars)
secrets.generateKey()            // 64-hex random key (CLI helper)
```

**When adding a new sensitive setting key:**
1. Add the key to `SECRET_KEYS` Set in `utils/secrets.js`.
2. Backend reads will auto-decrypt (via `feeService.getSetting`).
3. Admin GET will auto-mask. Admin PUT will auto-encrypt.
4. If the value already exists as plaintext in DB, run
   `node src/scripts/encrypt-existing-secrets.js` once.

---

## 🎨 Admin Panel — `admin/`

- **Pure static** — no bundler, no npm build. Just HTML + JS + CSS.
- **Routing:** Each page is a separate folder under `admin/pages/`
  (e.g. `pages/products/products.html` + `products.js`).
- **API base URL:** Configured in `admin/assets/js/config.js` → `API_URL`.
- **Layout/sidebar:** `admin/assets/js/layout.js` injects the sidebar on every page. Brand name & logo are pulled from `appsettings` (`admin_brand_name`, `admin_logo_url`) and cached 5 min in `localStorage` as `dd_admin_branding`.
- **Settings page** (`pages/settings/settings.js`) renders sensitive fields with a `🔒 Encrypted` badge and `••••XXXX` placeholder. On focus → field clears. On save → only sends fields the user actually edited (`dataset.cleared='1'`), so untouched secrets are preserved.

When editing admin pages, **always re-deploy the entire `admin/` folder** to the server (it's static, no build):
```powershell
scp -r admin\* root@server:/var/www/myshop/admin/
```

---

## 🌐 Web (Next.js)

- App Router. TypeScript strict.
- API calls go to `process.env.NEXT_PUBLIC_API_URL` (must end with `/api`).
- After build, deployed via PM2: `pm2 start npm --name web -- start`.

---

## 🚢 Production Server (current)

- Host: **168.144.20.237** (Ubuntu, single VPS)
- Code path: `/var/www/damndeal/`
- Single `.env`: `/var/www/damndeal/.env`
- PM2 processes:
  - `damndeal-api` (backend, port 5000)
  - `damndeal-web` (Next.js web, port 3000)
- nginx in front (TLS via Let's Encrypt)
- MongoDB local: `mongodb://localhost:27017/damndeal`
- Deploy via `scp` from Windows PowerShell → `/tmp/` → `cp` to target → `pm2 restart`.

### Deploy snippet (PowerShell, current machine)

```powershell
$env:Path = "C:\Windows\System32\OpenSSH\;" + $env:Path
# Backend file
scp backend\src\path\to\file.js root@168.144.20.237:/tmp/file.js
ssh root@168.144.20.237 "cp /tmp/file.js /var/www/damndeal/src/path/to/file.js && rm /tmp/file.js && pm2 restart damndeal-api --update-env"

# Admin (entire folder)
ssh root@168.144.20.237 "rm -rf /tmp/admin_deploy && mkdir -p /tmp/admin_deploy"
scp -r admin\* root@168.144.20.237:/tmp/admin_deploy/
ssh root@168.144.20.237 "cp -r /tmp/admin_deploy/* /var/www/damndeal/admin/ && rm -rf /tmp/admin_deploy"
```

---

## 🛠️ Common Tasks (recipes for the agent)

### "Add a new admin setting field"
1. Backend: no schema change needed (AppSettings is generic key/value).
2. Admin UI: `admin/pages/settings/settings.js` → add to the `SETTINGS_GROUPS` config object → reload page.
3. If sensitive: also add the key to `SECRET_KEYS` in `backend/src/utils/secrets.js`.
4. Backend code that needs it: `await feeService.getSetting("your_key")`.

### "Add a new admin page"
1. Create `admin/pages/<name>/<name>.html` + `<name>.js` (copy structure from `pages/products/`).
2. Add nav link in `admin/assets/js/layout.js` sidebar HTML.
3. Title in `<head>`: `<title>Your Page · Admin Panel</title>`.

### "Add a new backend route"
1. Create controller in `backend/src/modules/<scope>/controllers/`.
2. Wire in `backend/src/modules/<scope>/routes.js`.
3. Auth middleware: `requireAuth("admin"|"user"|"partner")`.

### "Run the encrypt-existing-secrets migration"
```bash
ssh root@server "cd /var/www/damndeal && node src/scripts/encrypt-existing-secrets.js"
```

### "Verify encryption round-trip"
Write a script in `backend/src/scripts/`, scp it, run from the project root so `node_modules` resolves:
```bash
ssh root@server "cd /var/www/damndeal && node src/scripts/<script>.js"
```
**Don't** put scripts in `/tmp/` — they can't find `node_modules`.

---

## ⚠️ Pitfalls (real lessons learned)

- **PowerShell + ssh + node -e + JSON** = quoting hell. Always write a `.js` file, scp it, then `ssh node /path/to/file.js`. Never inline.
- **Scripts in `/tmp/`** can't `require('dotenv')` because Node won't find `node_modules`. Either `cd /var/www/damndeal && node /tmp/script.js`, or place script under `/var/www/damndeal/src/scripts/`.
- **`SETTINGS_ENCRYPTION_KEY` is irreplaceable.** If lost, every encrypted value in DB becomes garbage. Always back it up to a password manager.
- **`platform: "damndeal"` and `"ddgo"`** in DB = enum values, NOT user-facing brand labels. Don't rename.
- **Admin is static** — no npm install, no build. Edit JS file → scp → done.
- **After editing `.env` on server**, always `pm2 restart damndeal-api --update-env` (the `--update-env` flag is mandatory, otherwise PM2 keeps old env).

---

## 📚 Where to read more

- [`SETUP.md`](SETUP.md) — full human-readable setup walkthrough (start here for a fresh install).
- [`backend/.env.example`](backend/.env.example) — every env var documented inline with usage notes.
- [`backend/CONCEPT_OVERVIEW.txt`](backend/CONCEPT_OVERVIEW.txt) — original product concept doc.

---

## 🧠 When the user asks you (the AI) for help

- **Setup questions** → point to `SETUP.md` and execute the relevant section.
- **"How do I add admin OTP login?"** → `SETUP.md` Section 5.
- **"Encryption broken / secret showing as garbage"** → check `SETTINGS_ENCRYPTION_KEY` is set in `.env` and matches the one used when the value was encrypted.
- **"How do I deploy?"** → `SETUP.md` Section 8 + the deploy snippet above.
- **Before editing files** → use `read_file` first; many files are large.
- **Before running terminal commands on Windows** → prepend `$env:Path = "C:\Windows\System32\OpenSSH\;" + $env:Path` so `ssh`/`scp` are found.

---

## 💾 Database backups

Nightly `mongodump` at **03:30 server time** via root crontab → `/root/mongo-backup.sh`
(source of truth: `ops/mongo-backup.sh` in this repo).

- Databases: `damndeal`, `adsservices`, `magicclub`, `roadhustler`
- Output: `/var/backups/mongo/daily/<db>-YYYY-MM-DD.gz` (gzipped archives)
- The 1st of each month is also copied to `/var/backups/mongo/monthly/`
- Retention: 30 daily, 12 monthly · Log: `/var/log/mongo-backup.log`
- An archive under 1KB is treated as a failed dump and deleted, so a truncated
  file never masquerades as a backup

**Restore one collection into a scratch database first — never straight over live:**
```bash
mongorestore --gzip --archive=/var/backups/mongo/daily/damndeal-2026-08-16.gz \
  --nsInclude='damndeal.couponcampaigns' \
  --nsFrom='damndeal.couponcampaigns' --nsTo='damndeal_verify.couponcampaigns' --drop
# inspect damndeal_verify, copy back only what you need, then dropDatabase()
```

⚠️ These archives live on the **same disk as the database**. They cover a bad
write or a dropped collection; they do NOT cover losing the VPS. Off-site copies
are still an open item.

⚠️ **Before editing production data to test something, dump the document first**
(`mongosh --eval 'printjson(db.coll.findOne({_id:...}))'`). A coupon description
was lost this way on 2026-08-15, before these backups existed.


---

## 🔐 Admin access & the fixed-OTP rule

Admin sign-in is OTP-based and gated by `ADMIN_PHONES` in `.env`.
`x-client-type: admin` asks for the console; the phone must be on that list,
otherwise it must match an active `Staff` record and logs in as `staff`.
Role `admin` bypasses every `requirePermission` check — staff do not.

**A number with a fixed test OTP can never sign into the console.**
`TEST_PHONE_OTPS` / `TEST_PHONES` exist so the owner and the app-store reviewer
can sign in without waiting for an SMS. That code never changes, never expires,
skips the send rate limit, and one unauthenticated send resets the attempt
counter — so it is a permanent 6-digit password with unlimited guesses. Fine for
a shopping account; a standing back door for an admin one.

How it is enforced (all three, so config alone cannot reopen it):
- `sendOtp` ignores the fixed code when the request carries
  `x-client-type: admin` and sends a real, expiring OTP instead.
- `verifyOtp(phone, otp, { allowFixed:false })` is what the admin path calls,
  so the fixed code falls through to the normal attempt-limited check.
- The send rate limiter no longer exempts admin-panel requests.

Allow-listed admin phones DO skip the bot guard's IP reputation block, so a VPN
or a flagged ISP cannot lock the owner out. The security boundary there is the
real OTP on a handset, not the IP; rate limits and attempt counts still apply.

`ADMIN_PHONES` **fails closed**: an empty or unloaded value refuses every admin
login. It previously granted full admin to any phone that asked.

⚠️ Never add an `ADMIN_PHONES` number to `TEST_PHONE_OTPS`. The code will refuse
it, but the intent is wrong — use a separate number for testing.
