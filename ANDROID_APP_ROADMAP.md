# DamnDeal Android Apps — Future-Proof Wrapper (dono apps)

> Goal: app EK baar update karo, uske baad **saal bhar website changes se hi**
> naye features milte rahein — Flipkart-style "webapp jo native lagta hai".

## Is update me kya gaya hai (v India 1.0.3+4 · US 1.0.1+2)

Dono apps me ek naya module hai `lib/web/native_web.dart` — website jo bhi
native cheez maange, app jawab de deta hai. **Koi permission pehle se nahi
maangi jaati** — OS ka sheet tabhi aata hai jab page us feature ko use kare.

| Capability | Pehle | Ab |
|---|---|---|
| **Camera / mic (getUserMedia)** | silently blocked → coupon QR scanner mar jata tha | permission sheet → grant. QR scanner, future video/reels, sab web se hi chalega |
| **Location (navigator.geolocation)** | India ✓ / US ✗ | dono me. Prompt handler + GeoBridge (iOS parity) |
| **Photo upload (`<input type=file>`)** | tap ignore ho jata tha | gallery picker; page `capture` maange to seedha camera. Multiple bhi. Reviews/KYC/profile photo — sab web se |
| **Media autoplay** | tap-first rule | off — product videos turant chalte hain |
| **System font-size** | बड़ा font layout tod deta tha | text zoom 100 pe pinned — layout stable |
| **App Links** | damndeal.in links browser me khulte the | `https://damndeal.in/...` / `damndeal.com/...` seedha app me khulenge (assetlinks.json site pe live hai; dono apps same release key) |

Manifest (dono): `CAMERA`, `RECORD_AUDIO`, location (US me naya),
`POST_NOTIFICATIONS` (US), camera hardware **optional** (Play tablets se app
nahi chhupayega). Storage permission ki zarurat nahi — system photo picker.

## Ye "bina app update" kaise deta hai

Website roz badalti hai, app kabhi-kabhi. Ab jo bhi naya web feature **camera,
mic, location, ya upload** use karta hai, wo purane installed app me bhi
chalega — kyunki app ke paas har capability ka standing handler hai. Aage naya
APK sirf tab chahiye jab koi *bilkul nayi native* cheez aaye (niche list).

## Build & release (Mac/Windows dono se same)

```sh
cd webviewapp        # ya damndealcomapp
flutter pub get
flutter build appbundle --release
# output: build/app/outputs/bundle/release/app-release.aab → Play Console
```

Versions abhi: India `1.0.3+4`, US `1.0.1+2`. Har release pe `+N` badhana.

## Roadmap — aage kya, kab

**Phase A — ye release (ho gaya, upload karna baki)**
- [x] Saari web-facing capabilities (upar wali table)
- [x] App Links + assetlinks.json live
- [ ] Play Console pe dono AAB upload (aapka step)
- [ ] Play permission declaration: Location = "delivery availability &
      nearby stores", Camera = "QR coupon scan & photo upload" likhna

**Phase B — agla release (jab time mile; zaroori nahi)**
- [ ] US app me FCM push (Firebase project me `com.damndealcom.in` add →
      google-services.json → India wala hi FCM code copy)
- [ ] `WillPopScope` → `PopScope` (Android predictive-back)
- [ ] In-app review prompt (order deliver hone ke baad) — `in_app_review`
- [ ] Play In-App Update API — naya version aaye to app khud update offer kare

**Phase C — kabhi zaroorat pade to**
- [ ] Biometric lock (payments ke liye)
- [ ] Native splash-to-content transition polish
- [ ] iOS: dono apps me yehi capabilities (Info.plist strings pehle se hain;
      WKWebView getUserMedia iOS 15+ pe khud prompt karta hai — mostly free)

## Smoothness ka sach (Flipkart jaisa feel)

Wrapper ki smoothness 80% **website** se aati hai, 20% shell se. Shell ab
sab de raha hai (hardware acceleration default on, autoplay, pinned zoom,
edge-to-edge). Website side pehle se: client-side routing (reload nahi),
prefetch, skeletons. Aage jo sabse zyada feel sudharega wo web pe hai:
image sizes/lazy-loading aur route prefetch — wo bina kisi app release ke
hota rahega.

## Kya kabhi nahi karna

- `ADMIN_PHONES` wala number `TEST_PHONE_OTPS` me nahi (AGENTS.md dekho)
- Keystore `damndeal-release.jks` + password kho gaya = dono apps update
  karna hamesha ke liye impossible. Backup rakho (password: aapke paas).
- Manifest se koi permission HATANA release ke baad — जो user grant kar
  chuka wo wapas maangna padta hai.
