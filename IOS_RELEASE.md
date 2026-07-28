# DamnDeal — iOS Release Guide (dono apps)

Sab compliance kaam ho chuka hai. Aapko Mac pe sirf ye steps karne hain.

## Apps

| | India app | US app |
|---|---|---|
| Folder | `webviewapp/` | `damndealcomapp/` |
| Bundle ID | `com.damndealappp.in` | `com.damndealcom.in` |
| Display name | Damndeal | DamnDeal |
| Version | 1.0.2 (build 3) | 1.0.0 (build 1) |
| Website | damndeal.in | damndeal.com |
| Firebase/FCM | Android-only (iOS pe auto-off) | Nahi hai |

## Pehli baar Mac pe (one-time setup)

1. Flutter install karo (`flutter doctor` sab green ho, Xcode + CocoaPods ke saath).
2. Apple Developer account ($99/yr) active ho aur Xcode me Sign in ho (Settings → Accounts).

## Har app ke liye build steps

Terminal me (pehle India, phir US — same steps):

```sh
cd webviewapp        # ya damndealcomapp
flutter pub get
cd ios && pod install && cd ..
open ios/Runner.xcworkspace   # .xcworkspace kholna, .xcodeproj NAHI
```

Xcode me:

1. Left panel me **Runner** select karo → **Signing & Capabilities** tab.
2. **Team** = apni Apple Developer team choose karo. ("Automatically manage signing" ✔ rehne do — Xcode khud provisioning profile bana lega.)
3. Bundle Identifier already set hai — change mat karna.
4. Top bar me device selector = **Any iOS Device (arm64)**.
5. **Product → Archive**. Complete hone pe Organizer khulega.
6. **Distribute App → App Store Connect → Upload** → sab defaults pe Next → Upload.

## App Store Connect me

1. https://appstoreconnect.apple.com → **My Apps → + → New App**:
   - India: naam "Damndeal", Bundle ID `com.damndealappp.in`, SKU `damndeal-in`
   - US: naam "DamnDeal", Bundle ID `com.damndealcom.in`, SKU `damndeal-com`
2. Upload hui build ko version me attach karo (processing me 15–30 min lag sakte hain).
3. **Export compliance**: kuch nahi puchhega — `ITSAppUsesNonExemptEncryption=false` plist me already set hai.
4. **App Privacy** questionnaire:
   - Data collected: Contact Info (name, email, phone), Purchase history, Physical address — "linked to user", app functionality ke liye. Tracking = **No**.
5. **App Review Information → Sign-in required** ✔ (India app):
   - Phone: `9876543210` — OTP: `600265` (fixed test OTP)
   - Notes me likho: "E-commerce app. Use the provided test phone number; OTP is fixed for review."
   - US app email/password login use karta hai — ek test account bana ke wahi do.
6. Screenshots: 6.7" (iPhone 15 Pro Max) required. Simulator me app chala ke `Cmd+S` se lo.
7. Privacy Policy URL: `https://damndeal.in/privacy-policy` / `https://damndeal.com/privacy-policy`

## Kya kya already fix ho chuka hai (dobara mat chhedna)

- ✅ Unique bundle IDs (pehle dono me duplicate tha — App Store reject ho jata)
- ✅ `Podfile` dono me (`platform :ios, '13.0'`)
- ✅ Info.plist: encryption-exempt key, camera/photo/mic/location usage descriptions, portrait-only
- ✅ India app ka Firebase iOS pe guarded — bina `GoogleService-Info.plist` ke bhi crash nahi hoga
- ✅ App icons (21 sizes, no-alpha PNG — App Store safe)

## Note: iOS pe push notifications (India app)

Abhi iOS pe FCM off hai (koi crash nahi, app pura chalega — bas push nahi aayega). Agar baad me iOS push chahiye: Firebase console me iOS app add karo (`com.damndealappp.in`) → `GoogleService-Info.plist` download karke `ios/Runner/` me daalo → mujhe bolna, main guard update kar dunga + APNs key setup guide dunga.
