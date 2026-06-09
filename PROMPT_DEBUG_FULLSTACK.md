# PROMPT: Full-Stack Debug & Polish Pass

Read `CLAUDE.md`, `apps/web/CLAUDE.md`, `apps/client/CLAUDE.md` (if exists) before starting.
Reference: `docs/api-spec.md`, `.claude/rules/clean-code.md`, `.claude/rules/i18n.md`

You are doing a **deep, systematic debug pass** across the entire platform.
Work methodically through each section. Fix everything you find. Run build/test after each service.

---

## Context

Monorepo: NestJS auth (3001) + Spring Boot chat (8080) + NestJS ai (3002) + Flutter mobile + Next.js web.
Production: Cloud Run (asia-southeast1) + Vercel + Upstash Redis + MongoDB Atlas.
CI/CD: `.github/workflows/deploy.yml` — pushes to `main` trigger full deploy.

Known issues to fix (not exhaustive — find more during audit):
- Next.js: `proxy.ts` must be deleted (only `middleware.ts` should exist)
- Android: `compileSdk` plugin conflict — already fixed in `android/build.gradle.kts` but verify
- Web UI: Remove logo/app name from login and register pages (keep only card + form)
- Web: Ensure responsive layout works on mobile browsers (375px viewport)

---

## Task 1 — Next.js Web (`apps/web/`)

### 1a. Delete proxy.ts
```bash
rm apps/web/proxy.ts
```

### 1b. UI cleanup — Login & Register pages
Files: `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`

- Remove any logo, app name ("PON", gradient text header, icon) that appears **outside** the Card
- The page should be: full-screen centered background → Card (max-w-sm) → form inside card
- Keep existing form fields, validation, error states — only remove the branding element above/outside the card

### 1c. Mobile responsiveness audit
Test at 375px viewport width. Fix any of:
- Horizontal scroll caused by fixed widths
- Buttons/inputs overflowing the card
- Sidebar in `(main)/layout.tsx` not collapsing on mobile
- Message bubbles wider than viewport

Ensure `(main)/layout.tsx` has: on mobile → sidebar hidden by default, full-width message area.
If sidebar toggle is missing, add a hamburger button that toggles a Zustand `isSidebarOpen` state.

### 1d. TypeScript strict check
```bash
cd apps/web && pnpm build
```
Fix ALL TypeScript errors. Do not use `any` — use `unknown` + type guard.

### 1e. Middleware sanity check
`middleware.ts` must export `middleware` (not `proxy`) and have correct `config.matcher`.
Verify cookie name matches what `app/api/auth/set-cookie/route.ts` actually sets.

---

## Task 2 — Flutter Mobile (`apps/client/`)

### 2a. Android build fix
Verify `android/build.gradle.kts` has:
```kotlin
subprojects {
    afterEvaluate {
        if (extensions.findByName("android") != null) {
            extensions.configure<com.android.build.gradle.BaseExtension>("android") {
                compileSdkVersion(36)
            }
        }
    }
}
```
And `android/app/build.gradle.kts` has `compileSdk = 36`.

Run: `flutter build apk --debug` and fix any remaining errors.

### 2b. record package API
`record: ^7.0.0` — verify `chat_input_bar.dart` uses correct API:
```dart
await _recorder.start(
  const RecordConfig(encoder: AudioEncoder.aacLc),
  path: path,
);
```
If that fails, check pub.dev record 7.x changelog and use the correct signature.

### 2c. Remove web/desktop platform artifacts
Ensure these directories do NOT exist (they were supposed to be deleted):
- `apps/client/web/`
- `apps/client/macos/`
- `apps/client/windows/`
- `apps/client/linux/`

If any exist, delete them. Remove any `kIsWeb` guards in Dart code.

### 2d. Production URL check
`lib/core/api/dio_client.dart` must have:
```dart
const _authBaseUrl = 'https://auth-service-ec4ppoccna-as.a.run.app';
const _chatBaseUrl = 'https://chat-service-ec4ppoccna-as.a.run.app';
```
`lib/features/chat/data/stomp_service.dart` must use:
```dart
url: 'wss://chat-service-ec4ppoccna-as.a.run.app/ws',
```

### 2e. iOS Swift Package Manager warnings
Plugins: `record_darwin`, `flutter_webrtc`, `flutter_secure_storage`, `emoji_picker_flutter` — these warn about SPM. This is non-blocking for now. Do NOT try to fix — just confirm build still succeeds.

### 2f. Run flutter analyze
```bash
cd apps/client && flutter analyze
```
Fix any errors (not warnings). Do not suppress with `// ignore` unless truly unavoidable.

---

## Task 3 — auth-service (`apps/server/auth-service/`)

### 3a. Redis connection audit
`packages/database/src/redis/redis.module.ts` must have:
- `lazyConnect: true`
- `maxRetriesPerRequest: 0`
- `enableOfflineQueue: true`
- `.on('error', handler)` attached

### 3b. OTP flow test
Trace the full OTP flow in code:
`POST /auth/register` → sends email → `POST /auth/verify-otp` → account activated → `POST /auth/login`

Check: is the OTP stored in Redis with correct TTL? Is the key format consistent between set and get?

### 3c. Build check
```bash
cd apps/server/auth-service && pnpm build
```

---

## Task 4 — chat-service (`apps/server/chat-service/`)

### 4a. CORS config
File: `src/main/resources/application.yml`

Must support env var `ALLOWED_ORIGINS`. Find the CORS/WebSocket config Java class and ensure it reads from this property. Allowed origins must include:
- `https://platform-web-omega-amber.vercel.app`
- `https://auth-service-ec4ppoccna-as.a.run.app`

Add to `.github/workflows/deploy.yml` chat-service env_vars:
```
ALLOWED_ORIGINS=https://platform-web-omega-amber.vercel.app,https://auth-service-ec4ppoccna-as.a.run.app
```

### 4b. Redis URL for Spring Boot
`REDIS_URL` env var maps to `spring.data.redis.url`. Verify `application.yml` has:
```yaml
spring:
  data:
    redis:
      url: ${REDIS_URL:redis://localhost:6379}
```
The URL format must be `rediss://` (TLS) for Upstash in production.

### 4c. Build check
```bash
cd apps/server/chat-service && mvn package -DskipTests -q
```

---

## Task 5 — ai-service (`apps/server/ai-service/`)

### 5a. Redis pub/sub audit
`redis-subscriber.service.ts` — verify subscribe is inside try/catch.
`redis.module.ts` — same options as auth-service (`lazyConnect`, `enableOfflineQueue: true`, error handler).

### 5b. Build check
```bash
cd apps/server/ai-service && pnpm build
```

---

## Task 6 — CI/CD (`.github/workflows/deploy.yml`)

Audit the deploy workflow:
- All 3 services deploy to Cloud Run region `asia-southeast1`, project `project-f338c3d2-64dd-47cd-873`
- chat-service has `ALLOWED_ORIGINS` set (add if missing)
- No placeholder values like `URL_VỪA_COPY` remain anywhere
- pnpm lockfile version matches `packageManager` field in root `package.json`

---

## Task 7 — Commit & Push

After all fixes:
```bash
git add -A
git commit -m "fix: fullstack debug pass — web mobile layout, android build, CORS, Redis, middleware"
git push origin main
```

Wait for Vercel deploy to complete. Check build logs. Fix any remaining TypeScript errors in the Vercel build output.

---

## DO NOT

- Do not change API endpoints or auth flow logic
- Do not modify `apps/server/auth-service/src/` unless explicitly listed above
- Do not add new dependencies unless strictly necessary
- Do not break existing functionality while fixing other issues
- Do not add placeholder comments like `// TODO: fix later`
