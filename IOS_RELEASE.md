# DamnDeal — iOS Release Guide (dono apps)

Sab compliance kaam ho chuka hai. Aapko Mac pe sirf ye steps karne hain.

## Apps

| | India app | US app |
|---|---|---|
| Folder / zip | `webviewapp/` (`damndeal-india-ios.zip`) | `damndealcomapp/` (`damndeal-usa-ios.zip`) |
| Bundle ID | `com.damndealappp.in` | `com.damndealcom.in` |
| Display name | Damndeal | DamnDeal |
| Version | 1.0.2 (build 3) | 1.0.0 (build 1) |
| Website | damndeal.in | damndeal.com |
| Firebase/FCM | Android-only (iOS pe auto-off) | Nahi hai |
| Devices | **iPhone-only** (iPad nahi — iPad screenshots ki zaroorat NAHI) | **iPhone-only** |

## Pehli baar Mac pe (one-time setup)

1. Flutter install karo (`flutter doctor` sab green ho, Xcode + CocoaPods ke saath).
2. Apple Developer account ($99/yr) active ho aur Xcode me Sign in ho (Settings → Accounts).

## Pendrive se Mac pe

1. Dono zip Mac pe copy karo (e.g. `~/Desktop`) aur extract karo:
   ```sh
   cd ~/Desktop
   unzip damndeal-india-ios.zip -d damndeal-india
   unzip damndeal-usa-ios.zip -d damndeal-usa
   ```
2. Zip me sirf iOS-relevant code hai (lib/ios/assets/pubspec) — android folder,
   keystore, credentials kuch nahi hai. `flutter pub get` baki sab regenerate kar dega.

## Har app ke liye build steps

Terminal me (pehle India, phir US — same steps):

```sh
cd damndeal-india/webviewapp        # ya damndeal-usa/damndealcomapp
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
6. Screenshots: sirf **6.7" iPhone** (iPhone 15 Pro Max simulator) — 3 se 10 screenshots.
   **iPad screenshots ki zaroorat NAHI** — app iPhone-only set hai. Simulator me app chala ke `Cmd+S` se lo.
7. Privacy Policy URL: `https://damndeal.in/privacy-policy` / `https://damndeal.com/privacy-policy`

## ⚠️ Apple reject hone ka sabse bada risk — Guideline 4.2 (Minimum Functionality)

Apple website-wrapper apps ko kabhi-kabhi 4.2 pe reject karta hai ("just a website").
Risk kam karne ke liye:

- **Review Notes me ye likhna** (App Review Information → Notes):
  > "This is our official native shopping app for our own e-commerce platform
  > (we own the website and the brand). The app includes native features:
  > a native bottom tab bar (Home / Categories / Offers / Cart / Account),
  > a fully native Offers & Updates tab (server-driven content, pull-to-refresh,
  > haptic feedback), pull-to-refresh on the main pages, iOS Home Screen Quick
  > Actions (Offers / My Orders / My Cart via long-press on the app icon),
  > custom splash screen, native share sheet, native offline screen with retry,
  > external payment app handoff, and native navigation handling. We are the
  > brand owner — not a third-party wrapper."
- Account **Organization** type ho to best hai; Individual pe bhi chalega.
- Agar phir bhi 4.2 reject aaye: reply karke appeal karo (brand owner ho, Play Store
  pe same app live hai) — aksar appeal pe approve ho jata hai. Zaroorat pade to mujhe
  bolna, native features (in-app notifications screen, offline page, quick actions)
  add kar dunga.

## Kya kya already fix ho chuka hai (dobara mat chhedna)

- ✅ Unique bundle IDs (pehle dono me duplicate tha — App Store reject ho jata)
- ✅ `Podfile` dono me (`platform :ios, '13.0'`)
- ✅ Info.plist: encryption-exempt key, camera/photo/mic/location usage descriptions, portrait-only
- ✅ **iPhone-only** (`TARGETED_DEVICE_FAMILY = 1`) — iPad screenshots/support ki zaroorat nahi
- ✅ India app ka Firebase iOS pe guarded — bina `GoogleService-Info.plist` ke bhi crash nahi hoga
- ✅ App icons (21 sizes incl. 1024 marketing, no-alpha RGB PNG — App Store safe)
- ✅ UPI/tel/whatsapp external links iOS pe url_launcher se khulte hain (`LSApplicationQueriesSchemes` set)
- ✅ Min iOS 13.0 har jagah consistent (pbxproj + Podfile + AppFrameworkInfo.plist)
- ✅ **Native features (4.2 protection)**: native bottom tab bar (Home / Categories /
  Offers / Cart / Account — website ka nav app me hide hota hai), pura native
  Offers & Updates tab (live banners/products, pull-to-refresh, haptics),
  main pages pe bhi pull-to-refresh, Home Screen Quick Actions (app icon
  long-press → Offers / My Orders / My Cart), native offline screen — dono apps me

## Note: iOS pe push notifications (India app)

Abhi iOS pe FCM off hai (koi crash nahi, app pura chalega — bas push nahi aayega). Agar baad me iOS push chahiye: Firebase console me iOS app add karo (`com.damndealappp.in`) → `GoogleService-Info.plist` download karke `ios/Runner/` me daalo → mujhe bolna, main guard update kar dunga + APNs key setup guide dunga.
