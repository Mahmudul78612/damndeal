# Road Hustlers API — Frontend Developer Documentation

Complete reference for the Road Hustlers backend. Two frontends consume this one
API: the **Customer Website** and the **ERP / Admin portal**.

- **Base URL:** `https://api.road-hustlers.com/api`
- **Format:** JSON in, JSON out. All money is **USD** (numbers, 2 decimals).
- **Dates:** ISO-8601 UTC strings (e.g. `2026-06-16T16:53:07.534Z`).
- **IDs:** MongoDB ObjectId strings (24 hex chars).

---

## 1. Authentication & Headers

Every request that isn't public needs:

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

On the **login** call also send which app you are:

```
x-client-type: erp        # ERP / admin portal (staff, manager, admin)
x-client-type: website    # Customer website
```

### Token lifecycle
- `login` / `register` return `accessToken` (15 min) + `refreshToken` (30 days).
- When a request returns **401**, call `POST /auth/refresh-token` with the
  refresh token to get a new pair, then retry the original request.
- Store tokens in the frontend (localStorage / secure cookie). Send the access
  token on every request.

### Roles
| Role | Where | Can access |
|------|-------|-----------|
| `customer` | website | own profile, vehicles, work-orders, invoices, appointments |
| `staff` | ERP | assigned work orders, time logs, add parts/labor |
| `manager` | ERP | staff + customers, leads, invoices, inventory, reports |
| `admin` | ERP | everything + staff mgmt, settings, void/delete |

Higher roles inherit lower-role permissions.

---

## 2. Standard Response Shapes

**Success (single):**
```json
{ "success": true, "data": { ...object } }
```

**Success (list):**
```json
{
  "success": true,
  "items": [ ... ],
  "total": 134,
  "page": 1,
  "pages": 7,
  "limit": 20
}
```

**Action result:**
```json
{ "success": true, "message": "Estimate approved", "data": { ... } }
```

**Error (any failure):**
```json
{ "success": false, "message": "Customer not found" }
```

| HTTP | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Validation / bad input |
| 401 | Not authenticated / token expired |
| 403 | Authenticated but role not allowed |
| 404 | Not found |
| 409 | Conflict (duplicate, locked, already done) |
| 429 | Too many login attempts |
| 500 | Server error |

### List query params (all list endpoints)
| Param | Example | Notes |
|-------|---------|-------|
| `page` | `?page=2` | default 1 |
| `limit` | `?limit=50` | default 20, max 200 |
| `search` | `?search=brake` | matches relevant text fields |
| `sort` | — | default `createdAt` desc |
Plus per-resource filters (documented below).

---

## 3. AUTH  `/api/auth`

### POST `/auth/register`  — customer self-signup (website)
Public. Creates a customer with portal access.
```json
// body
{ "name": "Sarah Web", "email": "sarah@example.com", "password": "secret123", "phone": "5556667777" }
// 201
{ "success": true, "role": "customer", "user": { ...customer }, "accessToken": "...", "refreshToken": "..." }
```

### POST `/auth/login`  — staff OR customer
Public. Send `x-client-type` header (`erp` or `website`).
```json
// body
{ "email": "info@road-hustlers.com", "password": "Daljinder@0987654321" }
// 200
{ "success": true, "role": "admin", "user": { ...account }, "accessToken": "...", "refreshToken": "..." }
```
> Customers can only log in if portal is enabled. Wrong creds → 401.

### POST `/auth/refresh-token`
```json
{ "refreshToken": "..." }   // -> { "success": true, "accessToken": "...", "refreshToken": "..." }
```

### GET `/auth/me`  — current logged-in principal
Auth required. → `{ success, user, role }`

### POST `/auth/logout`
Auth required. Stateless — frontend just drops the tokens. → `{ success: true }`

---

## 4. ERP  `/api/erp`  (staff / manager / admin)

All ERP endpoints require a staff token. Role column shows the **minimum** role.

### 4.1 Dashboard & Reports

#### GET `/erp/dashboard`  — KPI summary  · staff
```json
{ "success": true, "data": {
  "revenueToday": 383.85, "revenueMonth": 12450.00,
  "openWorkOrders": 7, "ordersByStatus": { "estimate": 2, "in_progress": 3, "completed": 2 },
  "outstandingAmount": 2140.50, "outstandingInvoices": 4,
  "jobsCompletedMonth": 38, "avgTicket": 327.6,
  "lowStockCount": 5, "newLeads": 3, "appointmentsToday": 6
} }
```

#### GET `/erp/reports/revenue?from=&to=&groupBy=day|week|month`  · manager
```json
{ "success": true, "data": { "from": "...", "to": "...", "groupBy": "day", "total": 12450.00,
  "series": [ { "_id": "2026-06-15", "total": 980.5, "count": 4 } ] } }
```

#### GET `/erp/reports/inventory`  · manager
Returns stock valuation (`costValue`, `retailValue`), `distinctItems`, `totalUnits`, `lowStock[]`.

#### GET `/erp/reports/technicians?from=&to=`  · manager
Per-tech `clockedHours`, `billableHours`, `jobs`.

#### GET `/erp/reports/leads`  · manager
`byStatus`, `total`, `conversionRate` (%).

#### GET `/erp/reports/customers`  · manager
`topSpenders[]` (top 20 by lifetime spend).

#### GET `/erp/reports/sales-tax?from=&to=`  · manager
`taxCollected`, `taxableSales`, `invoices` — for tax filing.

### 4.2 Notifications

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/erp/notifications` | staff | own + role broadcasts. Returns `items`, `unread` |
| PATCH | `/erp/notifications/:id/read` | staff | mark one read |
| PATCH | `/erp/notifications/read-all` | staff | mark all read |

### 4.3 Leads  · manager

| Method | Path | Body / Query |
|--------|------|--------------|
| GET | `/erp/leads` | `?status=new&assignedTo=&search=` |
| POST | `/erp/leads` | `{ name, email, phone, vehicle, service, message, source, estimatedValue }` |
| GET | `/erp/leads/:id` | — |
| PATCH | `/erp/leads/:id` | `{ status, assignedTo, notes, followUpDate }` |
| POST | `/erp/leads/:id/convert` | `{ vehicle?: { year, make, model, ... } }` → creates Customer (+Vehicle) |

`status`: `new` · `contacted` · `quoted` · `converted` · `lost`

### 4.4 Customers  · staff

| Method | Path | Notes |
|--------|------|-------|
| GET | `/erp/customers` | `?search=&tag=&active=true` |
| POST | `/erp/customers` | **walk-in: only `name` required.** No email/password needed |
| GET | `/erp/customers/:id` | returns `{ customer, vehicles, openInvoices, recentOrders, balanceDue }` |
| PUT | `/erp/customers/:id` | edit profile |
| POST | `/erp/customers/:id/enable-portal` · manager | `{ email, password }` → grants website login |
| DELETE | `/erp/customers/:id` · admin | delete |

```json
// POST /erp/customers (walk-in)
{ "name": "John Walker", "phone": "5551234567" }
// add more if known:
{ "name": "Acme Fleet", "phone": "...", "email": "ops@acme.com",
  "company": "Acme Inc", "address": { "street": "1 Main St", "city": "Austin", "state": "TX", "zip": "78701" },
  "tags": ["fleet"], "source": "walk-in" }
```

### 4.5 Vehicles  · staff

| Method | Path | Notes |
|--------|------|-------|
| GET | `/erp/vehicles` | `?customer=<id>&search=` |
| POST | `/erp/vehicles` | `{ customer, year, make, model, trim, vin, licensePlate, color, mileage, engine, transmission }` |
| GET | `/erp/vehicles/:id` | — |
| PUT | `/erp/vehicles/:id` | edit |
| GET | `/erp/vehicles/:id/history` | all work orders for this vehicle |
| DELETE | `/erp/vehicles/:id` · manager | archive (soft delete) |

`transmission`: `automatic` · `manual` · `cvt` · `other`

### 4.6 Appointments  · staff

| Method | Path | Query / Body |
|--------|------|--------------|
| GET | `/erp/appointments` | `?date=YYYY-MM-DD` or `?from=&to=`, `?status=&tech=` |
| POST | `/erp/appointments` | see body below |
| GET | `/erp/appointments/:id` | — |
| PATCH | `/erp/appointments/:id` | `{ status, assignedTo, bay, preferredDate, timeSlot }` |

```json
// POST body
{ "customer": "<id|null>", "leadName": "Walk-in", "leadPhone": "555...",
  "vehicle": "<id|null>", "vehicleText": "2018 Camry",
  "serviceRequested": ["Oil change"], "preferredDate": "2026-06-20", "timeSlot": "09:00-10:00" }
```
`status`: `requested` · `confirmed` · `in_progress` · `completed` · `cancelled` · `no_show`

### 4.7 Services (labor catalog)

| Method | Path | Role |
|--------|------|------|
| GET | `/erp/services` `?category=&search=&active=true` | staff |
| POST | `/erp/services` | manager |
| PUT | `/erp/services/:id` | manager |
| DELETE | `/erp/services/:id` | manager |

```json
{ "name": "Front Brake Pad Replacement", "category": "Brakes",
  "laborHours": 1.5, "laborRate": 120, "flatPrice": null, "taxable": false }
```

### 4.8 Suppliers

| Method | Path | Role |
|--------|------|------|
| GET | `/erp/suppliers` `?search=` | staff |
| POST / PUT | `/erp/suppliers[/:id]` | manager |
| DELETE | `/erp/suppliers/:id` | admin |

```json
{ "name": "AutoZone Pro", "contactName": "Dave", "phone": "...", "email": "...", "accountNumber": "AZ-9921" }
```

### 4.9 Parts / Inventory

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/erp/parts` | staff | `?search=&category=&lowStock=true` |
| GET | `/erp/parts/low-stock` | staff | reorder list |
| GET | `/erp/parts/:id` | staff | — |
| POST | `/erp/parts` | manager | create |
| PUT | `/erp/parts/:id` | manager | edit (stock NOT editable here) |
| PATCH | `/erp/parts/:id/adjust` | manager | `{ delta: -2, reason: "damaged" }` manual correction |
| DELETE | `/erp/parts/:id` | manager | archive |

```json
{ "name": "Brake Pad Set — Ceramic", "partNumber": "BP-100", "category": "Brakes",
  "brand": "Bosch", "supplier": "<id>", "costPrice": 40, "sellPrice": 90,
  "quantityInStock": 10, "reorderLevel": 3, "location": "A4", "taxable": true }
```
> Stock changes **only** via: part add to invoiced work order (−), purchase order receive (+), or `/adjust`. Each part also returns `isLowStock` (computed).

### 4.10 Purchase Orders  · manager

| Method | Path | Notes |
|--------|------|-------|
| GET | `/erp/purchase-orders` | `?status=&supplier=` |
| POST | `/erp/purchase-orders` | create draft |
| GET | `/erp/purchase-orders/:id` | — |
| PATCH | `/erp/purchase-orders/:id` | edit / set `status: "ordered"` |
| POST | `/erp/purchase-orders/:id/receive` | **increments part stock** |

```json
// POST
{ "supplier": "<id>", "tax": 0, "shipping": 12,
  "items": [ { "part": "<id>", "partName": "Brake Pad Set", "quantity": 20, "costPrice": 40 } ] }
// totals (subtotal/total) are computed server-side.

// POST /receive  — optional partial receive:
{ "received": { "<partId>": 18 } }   // omit to receive full ordered qty
```
`status`: `draft` · `ordered` · `received` · `cancelled`

### 4.11 Work Orders (the job card)  · staff

| Method | Path | Notes |
|--------|------|-------|
| GET | `/erp/work-orders` | `?status=&tech=&customer=&search=` |
| POST | `/erp/work-orders` | needs `customer` + `vehicle` (walk-in OK) |
| GET | `/erp/work-orders/:id` | full populated job card |
| PATCH | `/erp/work-orders/:id` | edit fields/lines (locked once invoiced) |
| POST | `/erp/work-orders/:id/labor` | add one labor line |
| POST | `/erp/work-orders/:id/parts` | add one part line (pulls price from inventory) |
| DELETE | `/erp/work-orders/:id/line/:lineId?type=labor\|part` | remove a line |
| POST | `/erp/work-orders/:id/approve` | record estimate approval |
| POST | `/erp/work-orders/:id/clock-in` | `{ techId? }` start timer |
| POST | `/erp/work-orders/:id/clock-out` | `{ techId? }` stop timer |
| POST | `/erp/work-orders/:id/invoice` · manager | generate invoice + deduct stock |

```json
// POST create
{ "customer": "<id>", "vehicle": "<id>", "complaint": "Squeaky brakes", "mileageIn": 62000, "priority": "normal" }

// POST /labor
{ "description": "Front brake job", "hours": 1.5, "rate": 120, "tech": "<userId>", "taxable": false }
// or fixed price:  { "description": "Diagnostic", "flatPrice": 99 }

// POST /parts
{ "part": "<partId>", "quantity": 2 }       // description/prices auto-filled from inventory
// or manual line:  { "description": "Misc clip", "quantity": 4, "sellPrice": 3, "taxable": true }

// POST /approve
{ "method": "in_person" }                    // in_person | email | sms | portal

// PATCH (edit whole order)
{ "diagnosis": "Worn pads", "status": "in_progress", "discount": 10, "discountType": "percent" }
```
`status`: `estimate` · `approved` · `in_progress` · `on_hold` · `completed` · `invoiced` · `cancelled`
`priority`: `low` · `normal` · `high` · `urgent`

After any change the response returns the recalculated money fields:
`laborSubtotal`, `partsSubtotal`, `discount`, `taxRate`, `taxAmount`, `shopSuppliesFee`, `total`.

### 4.12 Invoices

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/erp/invoices` | manager | `?status=&customer=&overdue=true` |
| GET | `/erp/invoices/:id` | staff | full invoice + payments |
| POST | `/erp/invoices/:id/send` | manager | mark sent (email hook later) |
| POST | `/erp/invoices/:id/payments` | manager | record a payment |
| POST | `/erp/invoices/:id/void` | admin | void (only if unpaid) |

```json
// POST /payments
{ "amount": 383.85, "method": "card", "reference": "AUTH-7781", "note": "" }
// method: cash | card | check | ach | online | other
```
`status`: `draft` · `sent` · `partial` · `paid` · `overdue` · `void`
> Invoices are **created from a work order** via `POST /erp/work-orders/:id/invoice`, not created directly.

### 4.13 Payments daybook  · manager
GET `/erp/payments?from=&to=&method=` → list + `totalCollected`.

### 4.14 Staff  · manager

| Method | Path | Notes |
|--------|------|-------|
| GET | `/erp/staff` | `?role=&search=` |
| POST | `/erp/staff` | `{ name, email, password, role, phone, hourlyRate, specialties[] }` |
| PUT | `/erp/staff/:id` | edit (send `password` to reset). Only admin can set role `admin` |
| GET | `/erp/staff/:id/timesheet?from=&to=` | hours + jobs + productivity |

`role`: `staff` · `manager` · `admin`

### 4.15 Settings

| Method | Path | Role |
|--------|------|------|
| GET | `/erp/settings` | staff |
| PUT | `/erp/settings` | admin |

Key fields: `shopName`, `logo`, `address`, `phone`, `email`, `taxRate`, `taxLabor`,
`defaultLaborRate`, `shopSuppliesFeePercent`, `shopSuppliesFeeCap`, `invoiceDueDays`,
`businessHours[]`, `bays`, prefixes & start numbers.

---

## 5. WEBSITE  `/api/website`

### 5.1 Public (no auth)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/website/settings` | shop name, hours, address, phone |
| GET | `/website/services` | public price list |
| POST | `/website/leads` | quote/contact form |
| POST | `/website/appointments` | request appointment (guest or logged-in) |

```json
// POST /website/leads
{ "name": "Mike", "email": "mike@x.com", "phone": "555...", "vehicle": "2018 Camry",
  "service": "Brake inspection", "message": "ASAP please" }
// -> { success: true, message: "Thanks! We'll be in touch shortly." }

// POST /website/appointments
{ "leadName": "Mike", "leadPhone": "555...", "vehicleText": "2018 Camry",
  "serviceRequested": ["Oil change"], "preferredDate": "2026-06-20", "timeSlot": "10:00-11:00" }
// If the request carries a customer Bearer token, it is auto-linked to that customer.
```

### 5.2 Customer portal (auth, role=customer)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/website/profile` | my profile |
| PUT | `/website/profile` | edit `{ name, phone, address, company }` |
| GET | `/website/vehicles` | my vehicles |
| POST | `/website/vehicles` | add `{ year, make, model, ... }` |
| GET | `/website/vehicles/:id/history` | service history |
| GET | `/website/work-orders` | my estimates/jobs |
| GET | `/website/work-orders/:id` | one |
| POST | `/website/work-orders/:id/approve` | approve estimate |
| POST | `/website/work-orders/:id/decline` | decline estimate |
| GET | `/website/invoices` | my invoices |
| GET | `/website/invoices/:id` | one |
| POST | `/website/invoices/:id/pay` | online payment |
| GET | `/website/appointments` | my appointments |
| POST | `/website/appointments/:id/cancel` | cancel |

```json
// POST /website/invoices/:id/pay  (Stripe-ready)
{ "amount": 383.85, "paymentIntentId": "pi_...", "reference": "..." }
// amount optional — defaults to full amountDue.
```

---

## 6. Money / Calculation Rules (USD)

The backend computes all totals — the frontend just displays them.

```
laborLineTotal = hours × rate         (or flatPrice if set)
partLineTotal  = quantity × sellPrice
subtotal       = Σ labor + Σ parts
discount       = fixed $ or subtotal × percent
taxAmount      = (taxable lines, after discount) × taxRate/100
shopSuppliesFee= min(laborSubtotal × fee%, cap)
total          = subtotal − discount + tax + shopSuppliesFee
amountDue      = total − amountPaid
```
Default `taxRate` 8.25%, labor not taxed (configurable in Settings).

---

## 7. Typical Frontend Flows

**ERP — walk-in to paid (no website):**
1. `POST /erp/customers` `{name, phone}` → customerId
2. `POST /erp/vehicles` `{customer, year, make, model}` → vehicleId
3. `POST /erp/work-orders` `{customer, vehicle, complaint}` → workOrderId
4. `POST /erp/work-orders/:id/labor` and `/parts` → builds the estimate
5. `POST /erp/work-orders/:id/approve`
6. `POST /erp/work-orders/:id/invoice` → invoiceId (stock auto-deducts)
7. `POST /erp/invoices/:id/payments` `{amount, method}` → status `paid`

**Website — lead to customer:**
1. `POST /website/leads` (public form)
2. Advisor in ERP: `GET /erp/leads`, `POST /erp/leads/:id/convert`
3. `POST /erp/appointments`, then the walk-in flow above.

**Customer portal:**
`register` → `login (x-client-type: website)` → view vehicles / invoices →
`approve` estimate → `pay` invoice.

---

## 8. Quick Test (cURL)

```bash
# health
curl https://api.road-hustlers.com/api/health

# admin login
curl -X POST https://api.road-hustlers.com/api/auth/login \
  -H "Content-Type: application/json" -H "x-client-type: erp" \
  -d '{"email":"info@road-hustlers.com","password":"Daljinder@0987654321"}'

# use the token
curl https://api.road-hustlers.com/api/erp/dashboard \
  -H "Authorization: Bearer <accessToken>"
```

---

*Backend: Node.js + Express + MongoDB. Hosted at `https://api.road-hustlers.com`.
Questions on a field/endpoint → check `WORKFLOW.txt` for the data model & business logic.*
