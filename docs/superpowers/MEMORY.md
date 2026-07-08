# PON Project — Memory File

> Đọc file này để nhớ lại toàn bộ context. Prompt gợi ý: "Đọc file platform/docs/superpowers/MEMORY.md và tiếp tục hỗ trợ tao với dự án PON."

---

## Giao ước tao - mày

- **Mày là advisor only** — viết plan vào `.md` files, Claude Code (codebase) đọc plan và thực thi code. **Tuyệt đối không tự ý viết/sửa code trực tiếp.**
- **Không động vào** các hàm: `resolveWallpaper()`, `splitWallpaperFit()`, `splitWallpaperLayout()`
- Giao tiếp tiếng Việt, giữ thuật ngữ kỹ thuật bằng tiếng Anh
- Phản biện thẳng thắn khi tao sai, không đồng ý cho có
- Không hỏi thêm nếu đủ thông tin để làm

---

## Dự án PON

B2B AI assistant platform. Monorepo tại `/Users/phong/projects/personal/platform/`.

### Cấu trúc chính

```
platform/
├── apps/
│   ├── web/                          # Next.js web app
│   ├── client/                       # Flutter mobile app
│   └── server/
│       ├── auth-service/             # NestJS — auth, users, phone verify (:3001)
│       ├── chat-service/             # Spring Boot 3 / Java 21 — messaging, STOMP (:8080)
│       ├── ai-service/               # NestJS — AI orchestration (:3002)
│       └── connector-service/        # NestJS — MCP connectors, OAuth (:3003)
├── docs/superpowers/
│   ├── MEMORY.md                     # file này
│   └── plans/                        # plan files cho Claude Code thực thi
```

### Stack

- **Web**: Next.js, TypeScript, shadcn/ui, Firebase Auth (client SDK)
- **Mobile**: Flutter, Dart, Firebase Auth, FCM
- **Backend**: NestJS (auth/ai/connector) + Spring Boot 3/Java 21 (chat), MongoDB, Redis, RabbitMQ, Firebase Admin SDK, Google Cloud Run
- **DevOps**: Docker, GitHub Actions CI/CD, Vercel (web), Google Cloud (backend)
- **Firebase project**: `pon-c30fd`

### Production URLs

```
Auth service:      https://auth-service-942942821810.asia-southeast1.run.app
Chat service:      https://chat-service-942942821810.asia-southeast1.run.app
Web (Vercel):      https://platform-web-omega-amber.vercel.app
```

---

## Firebase — Trạng thái hiện tại ✅

| Item | Status |
|------|--------|
| Phone sign-in | ✅ Enabled |
| Authorized domain `platform-web-omega-amber.vercel.app` | ✅ Added |
| SMS region policy | ✅ Deny + empty (allow all countries) |
| Test number `+84817738889` / OTP `123456` | ✅ Saved |
| Billing plan | ✅ Blaze (Pay as you go) — real SMS hoạt động |

**Quan trọng**: `+84817738889` là test number — Firebase KHÔNG gửi SMS thật cho số này. Test SMS thật phải dùng số điện thoại khác.

### Firebase Config (web)

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC8q9vgMzZYEPqEYcT1nRPb2JrWmd3XXwI
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=pon-c30fd.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=pon-c30fd
NEXT_PUBLIC_FIREBASE_APP_ID=1:246431845875:web:246c24ecc32054f798d686
```

Đã có trong cả `.env.local` và `.env.production`. Không cần thêm vào Vercel settings riêng vì Next.js đọc `.env.production` lúc build.

---

## Plans đã viết — TẤT CẢ ĐÃ EXECUTE ✅ (xác minh qua git history, QC sweep 2026-07-08)

Toàn bộ plans từ 2026-06-28 → 2026-07-04 trong bảng cũ đã được Claude Code thực thi và merge
(block/mute `7df24b8b`, 3-tab list `3646accf`, Firebase phone auth `035786f7`, reCAPTCHA fix `ac41a8ee`,
role display `f6c97c63`, AI sessions `68926920`, security hardening `29b5bb47`, sidebar UX `0d7fa4cf`…).
Danh sách đầy đủ + trạng thái từng plan: xem `plans/README.md` (index).

Các plan frontier CHƯA execute (Bot Factory client UI):
- `plans/2026-06-25-personal-assistant-client-ui.md`
- `plans/2026-06-25-botfather-zone.md`
- `plans/2026-06-25-identity-bridge-bot-connector.md`

---

## Key files đã implement (Claude Code đã làm)

- `platform/apps/web/components/profile/PhoneField.tsx` — Web phone verification UI (Firebase Auth)
- `platform/apps/web/lib/firebase.ts` — Firebase client init
- `platform/apps/web/lib/api/auth.ts` — `verifyFirebasePhoneToken()` API call
- `platform/apps/server/auth-service/src/modules/firebase/firebase.module.ts` — Firebase Admin module
- `platform/apps/server/auth-service/src/modules/firebase/firebase-admin.service.ts` — Firebase Admin service
- `platform/apps/server/auth-service/src/modules/users/users.service.ts` — `verifyFirebasePhoneToken()` backend logic
- `platform/apps/server/auth-service/src/modules/users/users.controller.ts` — `POST /api/users/me/phone/verify`
- `platform/apps/client/lib/features/profile/ui/widgets/phone_verification_bottom_sheet.dart` — Flutter phone verification UI

---

## Bugs đã biết / chưa fix

(Không còn — reCAPTCHA re-render bug đã fix tại commit `ac41a8ee` theo plan `2026-06-30-recaptcha-rerender-fix.md`.)

---

## Context quan trọng khác

- **Firebase Phone Number Verification** (feature mới của Firebase) ≠ **Firebase Phone Auth**. PNV là Android-only, SIM-based, Vietnam chưa support. PON dùng Firebase Phone Auth (SMS OTP), không phải PNV.
- **reCAPTCHA badge** hiện ở góc màn hình là bình thường — Firebase Phone Auth Web yêu cầu theo Google ToS. Ẩn badge bằng CSS được nhưng phải kèm disclosure text "Protected by reCAPTCHA".
- **Twilio đã được migrate sang Firebase Phone Auth** theo plan `2026-06-29-firebase-phone-auth.md` — đã execute (commit `035786f7`).
- Backend `FIREBASE_SERVICE_ACCOUNT_BASE64`: private key dạng base64 JSON, để trong GitHub Secrets, CI/CD inject vào auth-service khi deploy.
