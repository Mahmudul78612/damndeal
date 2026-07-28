# DamnDeal Ads — Integration & API Docs

Self-hosted ad network with geo-targeting, click tracking, and **conversion
(sale) tracking** like Meta Pixel / Google Conversion Tracking.

- **Base URL:** `https://damndeal.in/ads/api`
- **Admin portal:** `https://damndeal.in/ads/admin/`
- **Advertiser portal:** `https://damndeal.in/ads/portal/`
- **Embed SDK:** `https://damndeal.in/ads/embed.js`
- **Conversion pixel:** `https://damndeal.in/ads/event.js`

Two audiences:
1. **App developers** — show ads in your apps (serve API / embed SDK).
2. **Advertisers** — track conversions (event API) to see sales from their ads.

All responses are JSON: `{ success: true, ... }` or `{ success: false, message }`.

---

## PART 1 — Showing ads in an app

### 1A. Easiest: drop-in SDK (Google AdSense style)
Renders a full ad unit (creative + headline + CTA button) automatically.

```html
<!-- where the ad should appear -->
<div class="dd-ad" data-zone="YOUR_ZONE_KEY" data-app="damndeal"></div>

<!-- once, near </body> -->
<script src="https://damndeal.in/ads/embed.js" async></script>
```
- Get `YOUR_ZONE_KEY` from Admin portal → **Zones**.
- Location is auto-detected from the viewer's IP (state-wise targeting).
- If no ad matches, the slot hides itself.
- SPA refresh: call `window.DDAds.refresh()` after route change.

### 1B. Manual (custom design): the serve API
```
GET  https://damndeal.in/ads/api/serve?zone=ZONE_KEY&app=damndeal
```
Optional overrides (server-side calls): `&ip=1.2.3.4` or `&country=IN&state=MH`.

**Response:**
```json
{
  "success": true,
  "ad": {
    "id": "....",
    "type": "banner",                       // banner | video
    "title": "Summer Sale 50% Off",
    "creativeUrl": "https://damndeal.in/ads/uploads/ads/x.jpg",
    "width": 320, "height": 50, "duration": 0,
    "cta": "Shop Now",
    "clickUrl": "https://damndeal.in/ads/api/click/<adId>?zone=...&app=..."
  },
  "location": { "country": "IN", "state": "MH", "city": "Mumbai" }
}
```
`"ad": null` means no matching ad → render nothing.

**Render it (the `clickUrl` handles click tracking + redirect):**
```html
<a href="${ad.clickUrl}" target="_blank">
  <img src="${ad.creativeUrl}" width="${ad.width}" height="${ad.height}">
</a>
<button onclick="location.href='${ad.clickUrl}'">${ad.cta}</button>
```
Video ad → use `<video src="${ad.creativeUrl}" autoplay muted loop playsinline>`.

> Calling `/serve` logs **one impression**. Opening `clickUrl` logs **one click** and 302-redirects to the advertiser's target URL.

Multiple ads at once:
```
GET /serve/multi?zone=ZONE_KEY&count=3   → { ads: [ ... ] }
```

---

## PART 2 — Conversion / Event Tracking  ⭐ (the "Event Manager")

This is how an advertiser sees **sales / signups that came from their ad** —
like Meta Pixel and Google Conversion Tracking.

### How attribution works
1. A user clicks an ad. Our `clickUrl` redirects to the advertiser's site and
   **automatically appends `?dd_click=<clickId>`** to the URL.
2. The advertiser's site remembers that `dd_click` id (for 30 days).
3. When the user later completes a purchase/signup, the site fires a
   **conversion event** with the click id → we attribute the sale to that exact ad.

There are **two ways** to send conversions. Use either (or both).

---

### 2A. Browser Pixel  (recommended — like Meta Pixel)

**Step 1 — On EVERY page** of the advertiser website, add:
```html
<script src="https://damndeal.in/ads/event.js"></script>
```
This script auto-captures `?dd_click=...` on the landing page and stores it.

**Step 2 — On the order-success / thank-you page**, fire the event:
```html
<script>
  ddq('purchase', { value: 1299, currency: 'USD', orderId: 'ORD-12345' });
</script>
```

`ddq(eventName, params)` parameters:

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `eventName` (1st arg) | string | yes | `purchase` · `lead` · `signup` · `add_to_cart` · or any custom name |
| `value` | number | no | sale amount (e.g. 1299) |
| `currency` | string | no | default `USD` |
| `orderId` | string | recommended | your order/txn id — used to **dedupe** (a page refresh won't double-count) |

Other event examples:
```js
ddq('lead');                                   // a form lead, no value
ddq('signup', { value: 0 });                   // a registration
ddq('add_to_cart', { value: 499, currency:'USD' });
ddq('purchase', { value: 2599, orderId:'INV-9' });
```

---

### 2B. Server-side Conversions API  (like Meta CAPI / Google)

For reliable server-to-server tracking (no browser needed). Each advertiser has
a **Conversion API Key** (find it in the Advertiser portal → Overview → *Event
Manager*, looks like `ddc_xxxxxxxx`).

```
POST https://damndeal.in/ads/api/event
Content-Type: application/json
x-api-key: ddc_your_advertiser_key
```
**Body:**
```json
{
  "event": "purchase",
  "value": 1299,
  "currency": "USD",
  "orderId": "ORD-12345",
  "clickId": "<optional dd_click id if you captured it>"
}
```
If `clickId` is omitted, we attribute to that advertiser's most recent ad click
from the same customer IP (last 30 days).

**cURL example:**
```bash
curl -X POST https://damndeal.in/ads/api/event \
  -H "Content-Type: application/json" \
  -H "x-api-key: ddc_your_advertiser_key" \
  -d '{"event":"purchase","value":1299,"currency":"USD","orderId":"ORD-12345"}'
```

---

### Event API — request reference

| Field | Where | Notes |
|-------|-------|-------|
| `event` | body/query | event name. default `purchase` |
| `value` | body/query | sale amount. default `0` |
| `currency` | body/query | default `USD` |
| `orderId` | body/query | dedupe key (per advertiser). highly recommended |
| `clickId` | body/query | `dd_click` value — best attribution |
| `apiKey` / `x-api-key` | body / header | advertiser key for server-side |
| `zone` | body/query | fallback attribution if no clickId |

**Responses:**
```json
{ "success": true,  "message": "Conversion recorded", "event": "purchase", "value": 1299 }
{ "success": true,  "deduped": true, "message": "Duplicate order ignored" }
{ "success": false, "message": "Could not attribute event (no matching click)" }
```

> Attribution priority: `clickId` (exact) → `x-api-key` + same IP recent click →
> `zone` + same IP recent impression.

---

### What advertisers then see
In the **Advertiser portal** (`/ads/portal/`) and **Admin portal**:
- **Conversions** count
- **Sale Value** ($ total attributed)
- **Conversion Rate** (conversions ÷ clicks)
- Per-ad + state-wise breakdown + daily trend

Full funnel: **Impressions → Clicks → CTR → Conversions → Sale Value**.

---

## PART 3 — Portal / Admin API (auth required)

Login returns a JWT. Send `Authorization: Bearer <accessToken>` on protected calls.

### Auth  `/api/auth`
```
POST /auth/login          { email, password }   (header x-client-type: admin | advertiser)
POST /auth/refresh-token  { refreshToken }
GET  /auth/me
POST /auth/logout
```

### Admin  `/api/admin`  (x-client-type: admin)
| Method | Path | Purpose |
|--------|------|---------|
| GET/POST/PUT/DELETE | `/admin/ads` | manage ads (POST = multipart upload) |
| PATCH | `/admin/ads/:id/status` | `{ status: active\|paused }` |
| GET/POST/PUT/DELETE | `/admin/advertisers` | advertiser accounts |
| GET/POST/PUT/DELETE | `/admin/zones` | placements (each has an `apiKey`) |
| GET | `/admin/analytics/overview` | network KPIs (incl. conversions) |
| GET | `/admin/analytics/ads/:id` | one ad: trend + state-wise + conversions |
| GET | `/admin/analytics/by-state` | state-wise aggregate |

**Upload an ad** (multipart `POST /admin/ads`): fields `creative` (file),
`title`, `type` (banner|video), `targetUrl`, `ctaText`, `width`, `height`,
`countries`/`states`/`cities` (JSON arrays), `weight`, `impressionCap`,
`startDate`, `endDate`, and either `advertiserId` (existing) **or**
`advertiserName`+`advertiserEmail`+`advertiserPassword` (creates a login).

### Advertiser  `/api/advertiser`  (x-client-type: advertiser)
```
GET /advertiser/me                      (includes your apiKey)
GET /advertiser/ads
GET /advertiser/ads/:id
GET /advertiser/analytics/overview      (impressions, clicks, conversions, value)
GET /advertiser/analytics/ads/:id       (trend + state-wise + conversions)
```

---

## Quick test
```bash
# health
curl https://damndeal.in/ads/api/health

# serve (no ad yet → ad:null)
curl "https://damndeal.in/ads/api/serve?zone=ZONE_KEY&country=IN"

# fire a test conversion (server-side)
curl -X POST https://damndeal.in/ads/api/event \
  -H "Content-Type: application/json" -H "x-api-key: ddc_xxx" \
  -d '{"event":"purchase","value":999,"orderId":"TEST-1"}'
```

---

## Cheat-sheet for an advertiser (give them this)
1. We give you: a **login** (portal) + your **Conversion API Key**.
2. Put `<script src="https://damndeal.in/ads/event.js"></script>` on every page.
3. On your success page: `ddq('purchase', { value: <amount>, orderId: '<id>' });`
4. Log in at `https://damndeal.in/ads/portal/` → see impressions, clicks,
   **conversions & sale value**, state-wise.
