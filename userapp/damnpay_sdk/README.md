# DamnPay SDK

Bill payments & recharge SDK for Flutter apps. Integrate DamnPay services into any app with just 3 lines of code.

## Quick Start

### 1. Add dependency

```yaml
# pubspec.yaml
dependencies:
  damnpay_sdk:
    path: ../tooling/damnpay_sdk  # or publish to pub.dev
```

### 2. Initialize

```dart
import 'package:damnpay_sdk/damnpay_sdk.dart';

void main() {
  // Initialize with your partner credentials
  DamnPay.init(
    apiKey: 'dp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    secretKey: 'dps_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  );
  
  runApp(MyApp());
}
```

### 3. Add Pay Bills button

```dart
// Option A: Ready-made button (auto-handles login)
DamnPayButton(
  phone: '9876543210', // your logged-in user's phone
)

// Option B: Manual control
ElevatedButton(
  onPressed: () async {
    await DamnPay.login(phone: '9876543210');
    DamnPay.openBillPay(context);
  },
  child: Text('Pay Bills'),
)
```

That's it! The SDK handles auth, UI, and payments.

---

## How It Works

```
Your App                    DamnPay Backend
  │                              │
  ├── DamnPay.init(key,secret) ──┤  (stores credentials)
  │                              │
  ├── DamnPay.login(phone) ──────┤  POST /sdk/auth
  │   apiKey + HMAC signature    │  → verifies partner
  │                              │  → finds/creates user
  │  ◄── session token ─────────┤  → returns JWT
  │                              │
  ├── DamnPay.openBillPay() ─────┤  GET /sdk/services
  │   (opens bill pay screen)    │  → returns available services
  │                              │
```

**Phone-based SSO**: If a user is logged in with phone `9876543210` in your app, they're automatically logged into DamnPay with the same phone — no OTP needed. The partner API key + HMAC signature provides trust.

---

## Security

- **HMAC-SHA256 signatures** prevent request tampering
- **Timestamp validation** prevents replay attacks (5-min window)
- **Partner credentials** authenticate your app
- **Session tokens** expire after 24 hours

### Signature Format
```
signature = HMAC-SHA256(secretKey, "apiKey|phone|timestamp")
```

---

## Getting Partner Credentials

Contact DamnPay team or use the admin API:

```bash
curl -X POST https://damnpay-payments-865851260105.asia-south1.run.app/sdk/partners \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_INTERNAL_SECRET" \
  -d '{"name": "My App"}'
```

Response:
```json
{
  "partnerId": "partner_xxxx",
  "apiKey": "dp_xxxx",
  "secretKey": "dps_xxxx",
  "allowedServices": ["billpay", "recharge", "metro"]
}
```

---

## API Reference

| Method | Description |
|--------|-------------|
| `DamnPay.init(apiKey, secretKey)` | Initialize SDK |
| `DamnPay.login(phone)` | Authenticate user by phone |
| `DamnPay.openBillPay(context)` | Open bill pay screen |
| `DamnPay.isLoggedIn` | Check if session is valid |
| `DamnPay.logout()` | Clear session |
| `DamnPay.getServices()` | Get available services |
| `DamnPayButton(phone)` | Ready-made button widget |
