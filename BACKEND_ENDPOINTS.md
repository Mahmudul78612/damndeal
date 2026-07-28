# RoadHustler ERP — Backend API Reference (Authoritative)

> **Status:** The backend is **fully built and live**. Every endpoint below is implemented and deployed.
> The old `server/index.js` proxy stub is no longer needed — point the frontend directly at the live API.

**Base URL:** `https://api.road-hustlers.com/api`
**Health check:** `GET /api/health` → `{ "status": "ok", "service": "roadhustler-api" }`

---

## Authentication

JWT Bearer tokens. Two principal types: **staff** (ERP panel) and **customer** (portal).

```
POST /api/auth/login   { email, password }   →   { token, refreshToken, user }
```
Then send on every protected request:
```
Authorization: Bearer <token>
```

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/auth/register` | POST | — | Create a staff/customer account |
| `/auth/login` | POST | — | Rate-limited |
| `/auth/refresh-token` | POST | — | `{ refreshToken }` → new token |
| `/auth/logout` | POST | token | Invalidate session |
| `/auth/me` | GET | token | Current user profile |

**Response shape (all endpoints):** `{ "success": true, "data": ... }` or `{ "success": false, "error": "..." }` with an HTTP status code.

**Role legend (ERP):** every `/erp/*` route needs a **staff** token. Some also need a higher role:
`(mgr)` = manager or admin · `(admin)` = admin only · no tag = any staff.

---

## ERP — Staff Panel (`/api/erp`)  · all require a staff Bearer token

### Dashboard & Reports
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/dashboard` | GET | staff |
| `/erp/reports/revenue` | GET | mgr |
| `/erp/reports/inventory` | GET | mgr |
| `/erp/reports/technicians` | GET | mgr |
| `/erp/reports/leads` | GET | mgr |
| `/erp/reports/customers` | GET | mgr |
| `/erp/reports/sales-tax` | GET | mgr |

### Notifications
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/notifications` | GET | staff |
| `/erp/notifications/read-all` | PATCH | staff |
| `/erp/notifications/:id/read` | PATCH | staff |

### Leads
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/leads` | GET | mgr |
| `/erp/leads` | POST | mgr |
| `/erp/leads/:id` | GET | mgr |
| `/erp/leads/:id` | PATCH | mgr |
| `/erp/leads/:id/convert` | POST | mgr | Lead → customer |

### Customers
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/customers` | GET | staff | Supports `?search=` |
| `/erp/customers` | POST | staff | Walk-in supported |
| `/erp/customers/:id` | GET | staff |
| `/erp/customers/:id` | PUT | staff |
| `/erp/customers/:id/enable-portal` | POST | mgr | Issues portal login |
| `/erp/customers/:id` | DELETE | admin |

### Vehicles
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/vehicles` | GET | staff | `?customer=:id` to filter |
| `/erp/vehicles` | POST | staff |
| `/erp/vehicles/:id` | GET | staff |
| `/erp/vehicles/:id` | PUT | staff |
| `/erp/vehicles/:id/history` | GET | staff | Service history |
| `/erp/vehicles/:id` | DELETE | mgr |

### Appointments
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/appointments` | GET | staff |
| `/erp/appointments` | POST | staff |
| `/erp/appointments/:id` | GET | staff |
| `/erp/appointments/:id` | PATCH | staff |
| `/erp/appointments/:id/start-work` | POST | staff | Creates a work order from the appointment |

### Services (labor catalog)
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/services` | GET | staff |
| `/erp/services` | POST | mgr |
| `/erp/services/:id` | PUT | mgr |
| `/erp/services/:id` | DELETE | mgr |

### Suppliers
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/suppliers` | GET | staff |
| `/erp/suppliers` | POST | mgr |
| `/erp/suppliers/:id` | PUT | mgr |
| `/erp/suppliers/:id` | DELETE | admin |

### Parts / Inventory
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/parts` | GET | staff |
| `/erp/parts/low-stock` | GET | staff |
| `/erp/parts` | POST | mgr |
| `/erp/parts/:id` | GET | staff |
| `/erp/parts/:id` | PUT | mgr |
| `/erp/parts/:id/adjust` | PATCH | mgr | Stock adjustment `{ delta, reason }` |
| `/erp/parts/:id` | DELETE | mgr |

### Purchase Orders
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/purchase-orders` | GET | mgr |
| `/erp/purchase-orders` | POST | mgr |
| `/erp/purchase-orders/:id` | GET | mgr |
| `/erp/purchase-orders/:id` | PATCH | mgr |
| `/erp/purchase-orders/:id/receive` | POST | mgr | Receives stock into inventory |

### Work Orders
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/work-orders` | GET | staff | `?status=`, `?customer=` |
| `/erp/work-orders` | POST | staff |
| `/erp/work-orders/:id` | GET | staff |
| `/erp/work-orders/:id` | PATCH | staff |
| `/erp/work-orders/:id/labor` | POST | staff | Add a labor line |
| `/erp/work-orders/:id/parts` | POST | staff | Add a part line (decrements stock) |
| `/erp/work-orders/:id/line/:lineId` | DELETE | staff | Remove a line |
| `/erp/work-orders/:id/approve` | POST | staff | Approve estimate |
| `/erp/work-orders/:id/clock-in` | POST | staff | Technician time tracking |
| `/erp/work-orders/:id/clock-out` | POST | staff |
| `/erp/work-orders/:id/invoice` | POST | mgr | Generate invoice from work order |

### Invoices
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/invoices` | GET | mgr |
| `/erp/invoices/:id` | GET | staff |
| `/erp/invoices/:id/send` | POST | mgr | Email to customer |
| `/erp/invoices/:id/payments` | POST | mgr | Record a payment `{ amount, method, reference, note }` |
| `/erp/invoices/:id/refund` | POST | mgr | `{ amount?, method?, reason? }` |
| `/erp/invoices/:id/void` | POST | admin | Void + restore part stock |

### Payments
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/payments` | GET | mgr | Payments daybook |
| `/erp/payments` | POST | mgr | Record payment `{ invoiceId, amount, method, reference, note }` |

### Staff
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/staff` | GET | mgr |
| `/erp/staff` | POST | mgr |
| `/erp/staff/:id` | PUT | mgr |
| `/erp/staff/:id/timesheet` | GET | mgr |

### Settings
| Endpoint | Method | Role |
|----------|--------|------|
| `/erp/settings` | GET | staff |
| `/erp/settings` | PUT | admin | Update (PATCH also accepted) |
| `/erp/settings` | PATCH | admin | Same as PUT |

---

## Website + Customer Portal (`/api/website`)

### Public (no auth)
| Endpoint | Method | Notes |
|----------|--------|-------|
| `/website/settings` | GET | Public shop info |
| `/website/services` | GET | Public service list |
| `/website/leads` | POST | Repair request form |
| `/website/appointments` | POST | Guest or logged-in customer (optional auth) |

### Customer portal (require a **customer** Bearer token)
| Endpoint | Method | Notes |
|----------|--------|-------|
| `/website/profile` | GET / PUT | My profile |
| `/website/vehicles` | GET / POST | My vehicles |
| `/website/vehicles/:id/history` | GET | Service history |
| `/website/work-orders` | GET | My work orders |
| `/website/work-orders/:id` | GET | Detail |
| `/website/work-orders/:id/approve` | POST | Approve estimate |
| `/website/work-orders/:id/decline` | POST | Decline estimate |
| `/website/invoices` | GET | My invoices |
| `/website/invoices/:id` | GET | Detail |
| `/website/invoices/:id/pay` | POST | Pay online |
| `/website/appointments` | GET | My appointments |
| `/website/appointments/:id/cancel` | POST | Cancel |

---

## Frontend migration notes

1. **Drop the local proxy.** Set API base URL to `https://api.road-hustlers.com/api` and send the `Authorization: Bearer <token>` header.
2. The endpoints previously marked *"need to implement"* (register, me, logout, and the full ERP suite) are **all live** — no backend work pending.
3. Two calls were aligned to the frontend:
   - `POST /erp/payments { invoiceId, amount, ... }` now works (alias of `/invoices/:id/payments`).
   - `PATCH /erp/settings` now works (same handler as `PUT`).
4. Uploads (e.g. vehicle photos) are served from `https://api.road-hustlers.com/uploads/...`.

_Last verified: 2026-06-28 against the live deployment._
