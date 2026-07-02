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
│       ├── auth-service/             # NestJS — auth, users, phone verify
│       ├── chat-service/             # NestJS — messaging
│       ├── ai-service/               # AI
│       └── connector-service/
├── docs/superpowers/
│   ├── MEMORY.md                     # file này
│   └── plans/                        # plan files cho Claude Code thực thi
```

### Stack

- **Web**: Next.js, TypeScript, shadcn/ui, Firebase Auth (client SDK)
- **Mobile**: Flutter, Dart, Firebase Auth, FCM
- **Backend**: NestJS, MongoDB, Firebase Admin SDK, Google Cloud Run
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

## Plans đã viết (Claude Code cần thực thi)

| File | Nội dung | Status |
|------|----------|--------|
| `plans/2026-06-28-block-behavior-and-mute-duration.md` | Block/mute logic | ⏳ Chưa execute |
| `plans/2026-06-28-conversation-list-tabs.md` | 3-tab conversation list | ⏳ Chưa execute |
| `plans/2026-06-28-security-and-ux-fixes.md` | Security & UX fixes | ⏳ Chưa execute |
| `plans/2026-06-28-edit-profile-ui-and-wallpaper-fix.md` | Edit profile UI | ⏳ Chưa execute |
| `plans/2026-06-29-brand-identity-and-cover-fix.md` | Brand identity + cover | ⏳ Chưa execute |
| `plans/2026-06-29-ux-improvements.md` | UX improvements | ⏳ Chưa execute |
| `plans/2026-06-29-firebase-phone-auth.md` | Firebase Phone Auth migration (Twilio → Firebase) | ⏳ Chưa execute |
| `plans/2026-06-30-recaptcha-rerender-fix.md` | Fix reCAPTCHA "already been rendered" bug | ⏳ Chưa execute |
| `plans/2026-06-30-phone-auth-production-ready.md` | Ẩn reCAPTCHA badge + disclosure text | ⏳ Chưa execute |
| `plans/2026-07-01-role-display-in-profile.md` | Hiển thị role trong profile (read-only, web + mobile) | ⏳ Chưa execute |
| `plans/2026-07-01-chat-ux-redesign.md` | Sidebar 2-state toggle + timestamp redesign + emoji bare | ⏳ Chưa execute |
| `plans/2026-07-01-notification-and-auth-fixes.md` | Notification buttons + read/unread split + OAuth redirect + OfflineBanner debounce | ⏳ Chưa execute |

### Prompt cho Claude Code thực thi tất cả

```
Đọc và thực thi các plan files sau theo thứ tự (quan trọng nhất trước):

1. platform/docs/superpowers/plans/2026-06-29-firebase-phone-auth.md
2. platform/docs/superpowers/plans/2026-06-30-recaptcha-rerender-fix.md
3. platform/docs/superpowers/plans/2026-06-30-phone-auth-production-ready.md
4. platform/docs/superpowers/plans/2026-06-28-block-behavior-and-mute-duration.md
5. platform/docs/superpowers/plans/2026-06-28-conversation-list-tabs.md
6. platform/docs/superpowers/plans/2026-06-28-security-and-ux-fixes.md
7. platform/docs/superpowers/plans/2026-06-28-edit-profile-ui-and-wallpaper-fix.md
8. platform/docs/superpowers/plans/2026-06-29-brand-identity-and-cover-fix.md
9. platform/docs/superpowers/plans/2026-06-29-ux-improvements.md
10. platform/docs/superpowers/plans/2026-07-01-role-display-in-profile.md
11. platform/docs/superpowers/plans/2026-07-01-chat-ux-redesign.md
12. platform/docs/superpowers/plans/2026-07-01-notification-and-auth-fixes.md

Không bỏ sót task nào trong mỗi plan.
```

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

### 1. reCAPTCHA re-render bug (Web)
**File**: `PhoneField.tsx`
**Lỗi**: `reCAPTCHA has already been rendered in this element`
**Root cause**: `handleResend()` clear `recaptchaRef.current = null` nhưng không clear innerHTML của `#recaptcha-container`. Lần send tiếp theo tạo verifier mới trên div cũ còn widget → crash.
**Fix**: `plans/2026-06-30-recaptcha-rerender-fix.md`

---

## Context quan trọng khác

- **Firebase Phone Number Verification** (feature mới của Firebase) ≠ **Firebase Phone Auth**. PNV là Android-only, SIM-based, Vietnam chưa support. PON dùng Firebase Phone Auth (SMS OTP), không phải PNV.
- **reCAPTCHA badge** hiện ở góc màn hình là bình thường — Firebase Phone Auth Web yêu cầu theo Google ToS. Ẩn badge bằng CSS được nhưng phải kèm disclosure text "Protected by reCAPTCHA".
- **Twilio đã được migrate sang Firebase Phone Auth** theo plan `2026-06-29-firebase-phone-auth.md` — Claude Code chưa execute.
- Backend `FIREBASE_SERVICE_ACCOUNT_BASE64`: private key dạng base64 JSON, để trong GitHub Secrets, CI/CD inject vào auth-service khi deploy.
