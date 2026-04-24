# 🚀 White-Label E-Commerce Platform — Setup Guide

> Ek complete white-label e-commerce + quick-commerce platform.
> Backend (Node.js/Express + MongoDB + Redis), Admin panel (vanilla JS),
> Web storefront (Next.js), Partner portal (Next.js), and mobile apps
> (Flutter — user, partner, delivery).

---

## 📑 Table of Contents

1. [Project Structure](#1-project-structure)
2. [Prerequisites](#2-prerequisites)
3. [Quick Start (Local Dev)](#3-quick-start-local-dev)
4. [Backend Setup — Detailed](#4-backend-setup--detailed)
5. [Admin OTP Login Setup (Fast2SMS WhatsApp)](#5-admin-otp-login-setup-fast2sms-whatsapp)
6. [Web Storefront Setup](#6-web-storefront-setup)
7. [Partner Portal Setup](#7-partner-portal-setup)
8. [Production Deployment](#8-production-deployment)
9. [Razorpay Payment Setup](#9-razorpay-payment-setup)
10. [Branding / White-label Customization](#10-branding--white-label-customization)
11. [Common Issues](#11-common-issues)
12. [Security Notes](#12-security-notes)

---

## 1. Project Structure

```
project-root/
├── backend/             # Node.js + Express API (port 5000)
│   ├── src/
│   │   ├── server.js           # entry point
│   │   ├── modules/            # admin/, user/, partner/, delivery/
│   │   ├── services/           # fee, notification, delhivery, fship, payment
│   │   ├── utils/secrets.js    # AES-256-GCM encryption
│   │   └── scripts/            # one-off migration scripts
│   ├── .env                    # ← YOU CREATE THIS (copy from .env.example)
│   └── .env.example
├── admin/               # Static admin panel (vanilla HTML/JS/CSS)
│   ├── index.html
│   └── pages/                  # 28 admin pages
├── web/                 # Next.js 16 storefront (port 3000)
│   └── .env.local              # NEXT_PUBLIC_API_URL=...
├── partnerportal/       # Next.js partner dashboard (port 3001)
├── userapp/             # Flutter user app
├── partnerapp/          # Flutter partner app
├── deliveryapp/         # Flutter delivery boy app
├── nginx-damndeal.conf  # production nginx config
└── scripts/             # deployment helpers
```

---

## 2. Prerequisites

Install on dev machine:

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | 20.x or 22.x LTS | https://nodejs.org/ |
| **MongoDB** | 6.0+ | Local install OR MongoDB Atlas (free tier OK) |
| **Redis** | 7.x | For OTP rate-limit & sessions |
| **Git** | latest | |
| **Flutter SDK** | 3.24+ | Only if you'll build the mobile apps |
| **PM2** (prod only) | latest | `npm i -g pm2` |

**Windows users:** Easiest is to install Mongo + Redis via Docker Desktop, or use MongoDB Atlas + Upstash Redis (both have free tiers).

---

## 3. Quick Start (Local Dev)

```bash
# 1. Clone
git clone <your-repo-url> myshop
cd myshop

# 2. Backend
cd backend
cp .env.example .env
# ← Edit .env (see Section 4 below). At minimum set MONGO_URI, REDIS_URL,
#    JWT_SECRET, JWT_REFRESH_SECRET, SETTINGS_ENCRYPTION_KEY, ADMIN_PHONES.
npm install
npm run dev          # starts on http://localhost:5000

# 3. Admin panel (no build — just open in browser)
# Edit admin/assets/js/config.js → set API_URL to http://localhost:5000/api
# Then open admin/index.html via a static server, e.g.:
npx serve admin -p 8080
# Visit http://localhost:8080

# 4. Web storefront
cd ../web
echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api" > .env.local
npm install
npm run dev          # starts on http://localhost:3000

# 5. Partner portal (optional)
cd ../partnerportal
echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api" > .env.local
npm install
npm run dev          # starts on http://localhost:3001
```

Done. Browser kholo → admin → login with the phone you set in `ADMIN_PHONES`.

> **Tip:** Set `TEST_PHONES=<your-phone>` and `TEST_OTP=123456` in `.env` so OTP works locally without burning Fast2SMS credits.

---

## 4. Backend Setup — Detailed

### 4.1 Generate required secrets

```bash
# JWT secrets (run twice, paste each result):
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Settings encryption key (run ONCE — never change after first use):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4.2 Edit `backend/.env`

Required minimum:

```env
PORT=5000
NODE_ENV=development

MONGO_URI=mongodb://localhost:27017/myshop
REDIS_URL=redis://localhost:6379

JWT_SECRET=<paste 96-char hex from step 4.1>
JWT_REFRESH_SECRET=<paste another 96-char hex>

# ★ NEVER lose this. Changing it = all encrypted DB values become unreadable.
SETTINGS_ENCRYPTION_KEY=<paste 64-char hex from step 4.1>

CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:8080

# ★ Phones allowed to receive admin OTP. Comma-separated, no +91, 10 digits.
ADMIN_PHONES=9876543210

# Local dev OTP bypass (DO NOT set in production)
TEST_PHONES=9876543210
TEST_OTP=123456
```

> **About `SETTINGS_ENCRYPTION_KEY`:** The platform encrypts all sensitive
> AppSettings (Fast2SMS API key, Razorpay secret, courier API tokens, etc.)
> with AES-256-GCM. **Back up this key** — if you lose it, you'll have to
> re-enter every API key in the admin panel.

### 4.3 Install + run

```bash
cd backend
npm install
npm run dev
```

Visit `http://localhost:5000/api/health` → should return `{"ok":true}`.

---

## 5. Admin OTP Login Setup (Fast2SMS WhatsApp)

The admin panel uses **phone + OTP** login (sent via Fast2SMS WhatsApp).
Setup happens in **two steps**: first, allow your phone (`.env`); then,
configure the WhatsApp sender (admin panel UI — no code changes).

### 5.1 Allow your phone for admin login

In `backend/.env`:
```env
ADMIN_PHONES=9876543210,9123456780      # comma-separated, max ~10
```

Restart backend:
```bash
# Local dev
# (just stop and restart `npm run dev`)

# Production
pm2 restart damndeal-api --update-env
```

**On first successful OTP login, a User document with `role:"admin"` is auto-created.** No manual DB insert needed.

> **Security:** If `ADMIN_PHONES` is empty, ANY phone can request an admin OTP. **Always set at least one number before production.**

### 5.2 Get Fast2SMS credentials

1. Sign up: https://www.fast2sms.com → verify email + phone.
2. Recharge wallet with at least ₹100 (WhatsApp credits ~₹0.40/msg).
3. Apply for **WhatsApp Business sender**: Dashboard → WhatsApp → Get Started → submit your business number for approval (1-3 days).
4. After approval, note down:
   - **API Key** → Account → API key (40-char string)
   - **Phone Number ID** → WhatsApp → My Numbers → click your sender → "Phone Number ID"
5. Create approved **WhatsApp templates** (one per use case):
   - **OTP template** (variable: `{{1}}` for OTP code) → after approval, copy the 5-digit Message ID
   - **Order Confirm template** (variables: order ID, amount)
   - **Out for Delivery template**
   - **Order Cancelled template**
   - Each takes 24-48 hrs to be approved by WhatsApp.

### 5.3 Paste credentials in admin panel

This is where the white-label magic happens — **no `.env` edit, no restart needed**:

1. Login to admin → **Settings** → 💚 **WhatsApp / Fast2SMS** group.
2. Fill in:
   - `Fast2SMS API Key` → paste 40-char key
   - `Fast2SMS Phone Number ID` → paste 16-digit ID
   - `OTP Message ID` → 5-digit template ID
   - `Order Confirm Template ID`
   - `Out For Delivery Template ID`
   - `Order Cancelled Template ID`
3. Click **Save All**.

**Behind the scenes:** Each value is encrypted with AES-256-GCM before storing in MongoDB. On display, it's masked as `••••XXXX` (last 4 chars). Click a field to clear and re-enter.

### 5.4 Test

1. Logout from admin.
2. Enter your `ADMIN_PHONES` number → click Send OTP.
3. WhatsApp message arrive within 5 sec.
4. Enter 6-digit OTP → logged in.

If no message arrives, check:
```bash
pm2 logs damndeal-api --lines 50 | grep -iE "NOTIFY|fast2sms"
```
Look for `[NOTIFY] tpl=XXXXX → 9876543210 OK` (success) or error response from Fast2SMS API.

---

## 6. Web Storefront Setup

```bash
cd web
echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api" > .env.local
npm install
npm run dev          # http://localhost:3000
```

**Production env** (`web/.env.local`):
```env
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
```

Build:
```bash
npm run build
npm start            # or use pm2 start npm --name web -- start
```

---

## 7. Partner Portal Setup

Same as web:
```bash
cd partnerportal
echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api" > .env.local
npm install
npm run dev          # http://localhost:3001
```

---

## 8. Production Deployment

Reference setup (Ubuntu 22.04 + nginx + PM2 + MongoDB local + Redis local):

### 8.1 Server prep

```bash
# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx mongodb redis-server git
sudo npm i -g pm2

# Mongo + Redis services
sudo systemctl enable --now mongod redis-server
```

### 8.2 Deploy code

```bash
cd /var/www
sudo git clone <your-repo> myshop
cd myshop

# Backend
cd backend
sudo cp .env.example .env
sudo nano .env       # ← fill all values (Section 4.2)
sudo npm install --omit=dev
pm2 start src/server.js --name api --update-env
pm2 save
pm2 startup          # follow the printed command

# Web
cd ../web
sudo bash -c 'echo "NEXT_PUBLIC_API_URL=https://yourdomain.com/api" > .env.local'
sudo npm install
sudo npm run build
pm2 start npm --name web -- start
pm2 save
```

### 8.3 Nginx (reverse proxy)

Adapt `nginx-damndeal.conf` (provided in repo root). Key blocks:

```nginx
server {
  listen 443 ssl http2;
  server_name yourdomain.com;
  ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

  # Admin panel (static)
  location /admin/ {
    alias /var/www/myshop/admin/;
    try_files $uri $uri/ /admin/index.html;
  }

  # API
  location /api/ { proxy_pass http://127.0.0.1:5000; ...proxy headers... }

  # Uploads
  location /uploads/ { alias /var/www/myshop/backend/uploads/; }

  # Web (Next.js)
  location / { proxy_pass http://127.0.0.1:3000; ...proxy headers... }
}
```

Get TLS:
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 8.4 Update admin panel API URL

Edit `admin/assets/js/config.js`:
```js
const API_URL = "https://yourdomain.com/api";
```

### 8.5 Health check

```bash
curl https://yourdomain.com/api/health     # → {"ok":true}
pm2 status                                  # api + web both online
```

---

## 9. Razorpay Payment Setup

1. Sign up: https://dashboard.razorpay.com
2. Complete KYC → switch to **Live mode**.
3. Settings → API Keys → **Generate Live Key** → copy:
   - `Key ID` (starts with `rzp_live_`)
   - `Key Secret`
4. Admin panel → Settings → 💳 **Payment / Razorpay** group → paste both → Save.
5. Webhook (optional but recommended):
   - Razorpay Dashboard → Webhooks → Add → URL: `https://yourdomain.com/api/payment/webhook`
   - Events: `payment.captured`, `payment.failed`, `refund.processed`
   - Copy webhook secret → paste in admin panel → `razorpay_webhook_secret`

---

## 10. Branding / White-label Customization

Everything is admin-panel driven. **No code edit needed** to rebrand.

| Setting key | What it controls |
|---|---|
| `admin_brand_name` | Sidebar title in admin (text fallback) |
| `admin_logo_url` | Sidebar logo image (overrides text if set) |
| `brand_name` | Storefront name |
| `brand_color` | Primary brand color (online store) |
| `quick_commerce_brand_color` | Quick-commerce app primary color |
| `support_email`, `support_phone` | Footer / contact pages |
| `legal_terms_html`, `legal_privacy_html`, `legal_refund_html` | Legal pages |

To change → admin panel → **Settings** → **App Customization** → edit → Save → hard-refresh (`Ctrl+Shift+R`).

For mobile apps: rebuild Flutter apps with new app name + icon (see `userapp/README.md`).

---

## 11. Common Issues

**"Cannot find module 'dotenv'"** → run `npm install` inside `backend/` first.

**OTP not received** → check (1) `ADMIN_PHONES` includes your number, (2) Fast2SMS keys saved in admin → Settings, (3) `pm2 logs api | grep NOTIFY`. For local dev, set `TEST_PHONES` + `TEST_OTP` in `.env`.

**"SETTINGS_ENCRYPTION_KEY missing — secrets stored as plaintext"** warning → set `SETTINGS_ENCRYPTION_KEY` in `.env` and restart.

**Admin shows `••••XXXX` and I can't see real key** → that's intentional (security). Click the field → it clears → enter new value (or re-paste original) → Save. Leaving it untouched preserves the existing encrypted value.

**Lost `SETTINGS_ENCRYPTION_KEY`** → all encrypted values are unrecoverable. Re-enter every key in admin → Settings.

**CORS error in browser** → add your frontend origin to `CORS_ORIGINS` in `.env` and restart.

**MongoDB connection refused** → ensure `mongod` is running: `sudo systemctl status mongod`.

---

## 12. Security Notes

- ✅ All sensitive AppSettings encrypted at rest (AES-256-GCM).
- ✅ Admin login requires phone OTP + phone must be in `ADMIN_PHONES`.
- ✅ Admin GET `/admin/settings` returns secrets masked (`••••XXXX`).
- ✅ JWT short access token (15min) + refresh token (30d).
- ⚠️  **Back up `SETTINGS_ENCRYPTION_KEY`** in your password manager (1Password, Bitwarden) — losing it = re-entering every API key.
- ⚠️  Never commit `.env` files. `.gitignore` already excludes them.
- ⚠️  Set `NODE_ENV=production` in prod (`.env`).
- ⚠️  Remove `TEST_PHONES` / `TEST_OTP` from production `.env`.
- ⚠️  Use HTTPS in production (Let's Encrypt is free).

---

## 📞 Need help?

1. Read [`AGENTS.md`](AGENTS.md) — explains the codebase to AI assistants (Claude, Copilot). Open this repo in VS Code with Copilot/Claude → ask any setup question, the agent will use the file for context.
2. Read [`backend/.env.example`](backend/.env.example) — every env var documented inline.
3. Backend logs: `pm2 logs api --lines 100`.
