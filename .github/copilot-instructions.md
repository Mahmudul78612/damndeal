# GitHub Copilot — Repository Instructions

This is a white-label e-commerce + quick-commerce platform. **Read [`AGENTS.md`](../AGENTS.md) and [`SETUP.md`](../SETUP.md) at the workspace root first** — they contain full architecture, conventions, deploy steps, and pitfalls.

## Quick facts

- **Backend:** Node.js 20 + Express + Mongoose + Redis. CommonJS (no TS). Path: `backend/src/`.
- **Admin:** vanilla static HTML/JS/CSS at `admin/` (no build step).
- **Web:** Next.js 16 App Router (TypeScript) at `web/`.
- **Production:** Ubuntu VPS, PM2 (`damndeal-api`, `damndeal-web`), nginx + Let's Encrypt. Code at `/var/www/damndeal/`.

## Critical rules

1. **Sensitive AppSettings** (Fast2SMS keys, Razorpay secret, courier tokens) are **encrypted at rest** with AES-256-GCM via `backend/src/utils/secrets.js`. Master key in `process.env.SETTINGS_ENCRYPTION_KEY` (64-hex). When adding a new sensitive setting key, add it to the `SECRET_KEYS` Set in that file.
2. **DB enum values** `platform: "damndeal"` and `platform: "ddgo"` are NOT user-facing brand names — never rename them. UI labels are "Online Store" and "Quick Commerce".
3. **Admin auth:** phone OTP, restricted by `ADMIN_PHONES` env (comma-separated 10-digit phones). Local dev bypass via `TEST_PHONES` + `TEST_OTP`.
4. **Deploy admin** = `scp -r admin\* root@server:/var/www/damndeal/admin/` (no build).
5. **Deploy backend** = scp file → cp → `pm2 restart damndeal-api --update-env` (the `--update-env` flag is mandatory).
6. **PowerShell + ssh quoting** is fragile — write `.js` files and scp them, never use `node -e "..."` over ssh.
7. **Scripts that require `node_modules`** must run from `/var/www/damndeal/` (use `cd /var/www/damndeal && node ...`), not from `/tmp/`.

## When making changes

- Read existing file first (`read_file`) before editing — many files are large.
- For Windows ssh/scp commands prepend: `$env:Path = "C:\Windows\System32\OpenSSH\;" + $env:Path`.
- Don't add docstrings/comments to code you didn't change.
- Don't create markdown docs unless explicitly asked.
