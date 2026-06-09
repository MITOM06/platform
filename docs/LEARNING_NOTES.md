# Learning Notes — Từ dự án Platform

> Tổng hợp kiến thức thực tế từ quá trình build + deploy dự án monorepo thực tế.
> Stack: NestJS + Spring Boot + Flutter + Next.js + Google Cloud Run + Vercel + Upstash Redis

---

## 1. Kiến trúc sản phẩm thực tế

### Monorepo là gì?

Một repo chứa nhiều service/app cùng lúc. Dự án này có:

```
platform/
  apps/
    server/auth-service/     ← NestJS (đăng ký, đăng nhập, OTP)
    server/chat-service/     ← Spring Boot (tin nhắn, WebSocket)
    server/ai-service/       ← NestJS (Claude AI, Redis pub/sub)
    client/                  ← Flutter (iOS + Android)
    web/                     ← Next.js (trình duyệt)
  packages/
    database/                ← shared code (Redis module dùng chung)
  infra/
    docker-compose/          ← chạy MongoDB + Redis local
```

**Tại sao dùng monorepo?** Dễ share code giữa services, một CI/CD pipeline cho tất cả, version control chung.

---

## 2. Cách các service nói chuyện với nhau

### REST API (HTTP)
Client → gọi thẳng tới service qua HTTPS.

```
Flutter/Next.js  →  POST https://auth-service.../auth/login
Flutter/Next.js  →  GET  https://chat-service.../api/conversations
```

### WebSocket (STOMP)
Dùng cho realtime — tin nhắn mới, typing indicator, online status.

```
Flutter/Next.js  ←→  wss://chat-service.../ws
```

STOMP là protocol chạy trên WebSocket. Client subscribe vào "topic" (kênh), server push data khi có event.

```
Subscribe: /topic/conversation/abc123   ← nhận tin nhắn mới
Subscribe: /user/queue/notifications    ← nhận notification cá nhân
Publish:   /app/chat.send               ← gửi tin nhắn
```

### Redis Pub/Sub (service-to-service)
Chat-service và AI-service nói chuyện với nhau qua Redis — không gọi HTTP trực tiếp.

```
chat-service → PUBLISH ai:request → Redis → ai-service nhận → gọi Claude API
ai-service   → PUBLISH ai:response:convId → Redis → chat-service nhận → push STOMP → client
```

**Quan trọng:** Redis pub/sub là fire-and-forget. Nếu subscriber không online lúc message được publish → message mất. Đó là lý do ai-service phải `min-instances=1`.

---

## 3. Deploy lên Cloud (Google Cloud Run)

### Cloud Run là gì?
Serverless container platform. Bạn đóng gói app vào Docker image, push lên, Cloud Run tự chạy và scale.

**Ưu điểm:**
- Scale to zero (không tốn tiền khi không có traffic)
- Tự scale up khi nhiều request
- Không cần quản lý server

**Nhược điểm:**
- Cold start (lần đầu request sau khi scale to zero bị chậm ~2-5s)
- Không phù hợp cho service cần persistent connection (như Redis subscriber) nếu để `min-instances=0`

### Quy trình deploy trong dự án này

```
Push code lên GitHub main
    → GitHub Actions trigger
    → Build Docker image
    → Push image lên Artifact Registry (Google)
    → Deploy lên Cloud Run
```

File `.github/workflows/deploy.yml` định nghĩa toàn bộ quy trình này.

### Docker image
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN pnpm install && pnpm build

# Runtime stage  
FROM node:20-alpine
COPY --from=builder /app/dist .
CMD ["node", "main.js"]
```

Multi-stage build: stage đầu build, stage sau chỉ copy output → image nhỏ hơn.

### Environment Variables trên Cloud Run
Secrets nhạy cảm (DB password, API key) không commit vào code. Lưu vào **GitHub Secrets** → deploy workflow inject vào Cloud Run lúc deploy.

```yaml
env_vars: |
  REDIS_URL=${{ secrets.REDIS_URL }}
  JWT_ACCESS_SECRET=${{ secrets.JWT_ACCESS_SECRET }}
```

---

## 4. Deploy Frontend

### Vercel (cho Next.js)
Vercel là platform chuyên cho Next.js. Connect GitHub repo → tự động deploy khi push.

**Quan trọng:** Vercel build từ source code, không phải Docker. `NEXT_PUBLIC_*` env vars được **bake vào bundle lúc build** — không thể đổi sau khi build xong mà không build lại.

```bash
# Env vars này được bake vào JS bundle khi pnpm build chạy
NEXT_PUBLIC_AUTH_URL=https://auth-service-....run.app
NEXT_PUBLIC_CHAT_URL=https://chat-service-....run.app
```

**Vercel với monorepo:** Phải set Root Directory = `apps/web/` trong Vercel dashboard. Vercel vẫn clone cả repo nhưng chỉ build từ thư mục đó.

### Flutter (mobile)
- **Debug:** `flutter run` — cắm USB, hot reload realtime
- **Release APK:** `flutter build apk --release` → file `.apk` cài lên Android
- **App Store / Play Store:** Cần signing certificate, Apple Developer account / Google Play account

---

## 5. Database

### MongoDB Atlas (cloud MongoDB)
- Managed database — không cần tự quản lý server
- Connection string: `mongodb+srv://user:pass@cluster.mongodb.net/dbname`
- **Quan trọng:** Whitelist IP của Cloud Run (hoặc allow all `0.0.0.0/0` cho dev)

### Upstash Redis (serverless Redis)
- Serverless Redis — tính phí theo request
- URL format cho TLS: `rediss://` (2 chữ s) — khác với local `redis://`
- Dùng cho: session/OTP (auth), pub/sub channel (AI), cache

**Lỗi hay gặp:**
```
WRONGPASS invalid username-password pair
```
→ Password trong URL sai. Copy đúng URL từ Upstash console, không copy lệnh `redis-cli`.

---

## 6. Authentication Flow

### JWT (JSON Web Token)
```
Đăng nhập → server trả accessToken + refreshToken
accessToken: ngắn hạn (15 phút), dùng cho mọi API call
refreshToken: dài hạn (7 ngày), dùng để lấy accessToken mới
```

### Interceptor pattern
Tất cả HTTP client (Dio trên Flutter, Axios trên Next.js) đều dùng interceptor để tự động:
1. Đính kèm `Authorization: Bearer <token>` vào header
2. Khi nhận 401 → tự gọi `/auth/refresh` lấy token mới → retry request gốc
3. Nếu refresh cũng fail → logout

```typescript
// Axios interceptor
instance.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 401) {
    const newToken = await refresh()
    error.config.headers.Authorization = `Bearer ${newToken}`
    return instance(error.config)  // retry
  }
  throw error
})
```

### OTP Flow
```
Register → server gửi email OTP → client nhập OTP
→ POST /auth/verify-otp → account activated → redirect login
```
OTP lưu trong Redis với TTL 5 phút. Key: `otp:{email}`.

---

## 7. Những lỗi hay gặp khi deploy

### Redis WRONGPASS
**Nguyên nhân:** Copy nhầm lệnh `redis-cli --tls -u redis://...` thay vì chỉ lấy URL.
**Fix:** Chỉ lấy phần `rediss://default:password@host:port`.

### enableOfflineQueue: false
**Nguyên nhân:** `lazyConnect: true` + `enableOfflineQueue: false` conflict — command đến trước khi connection ready thì bị reject ngay.
**Fix:** `enableOfflineQueue: true` để queue command chờ connection.

### Cloud Run cold start + Redis pub/sub
**Nguyên nhân:** Service scale về 0, message publish lúc không có subscriber → mất.
**Fix:** `min-instances=1` cho service cần persistent connection.

### Next.js middleware phải tên đúng
File phải là `middleware.ts` (không phải `proxy.ts`), export function tên `middleware`.

### pnpm lockfile mismatch
```
ERR_PNPM_LOCKFILE_MISMATCHED_PACKAGES
```
**Fix:** `pnpm install` lại để sync lockfile, commit `pnpm-lock.yaml`.

### compileSdk plugin conflict (Android)
Plugin cũ dùng compileSdk 34 nhưng dependency mới cần 36.
**Fix:** Override trong root `android/build.gradle.kts`:
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

---

## 8. Quy trình làm việc thực tế ở công ty

### Git flow cơ bản
```
main        ← production, luôn stable
develop     ← integration branch
feature/xxx ← làm feature mới, tạo từ develop
fix/xxx     ← bugfix
```

Khi làm xong → tạo Pull Request → code review → merge vào develop → deploy staging → test → merge vào main → deploy production.

### CI/CD (Continuous Integration / Continuous Deployment)
- **CI:** Mỗi lần push → tự động chạy test, lint, build → báo pass/fail
- **CD:** Khi merge vào main → tự động deploy lên production

Dự án này dùng **GitHub Actions** làm CI/CD.

### Environments
| Environment | Mục đích | URL |
|-------------|----------|-----|
| Local | Dev cá nhân | localhost |
| Staging | Test trước khi lên production | staging.app.com |
| Production | Người dùng thật | app.com |

**Quan trọng:** Không bao giờ test trực tiếp trên production. Luôn test trên staging trước.

### Quy trình test trên production
1. Push code lên branch
2. Chờ CI pass (build + test xanh)
3. Merge PR vào main
4. Chờ CD deploy xong (~3-10 phút)
5. Test trên production URL
6. Nếu có bug → tạo hotfix branch → fix → merge nhanh

---

## 9. Monitoring & Debug trên production

### Xem logs Cloud Run
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=auth-service" \
  --project=PROJECT_ID \
  --limit=30 --order=desc \
  --format='value(textPayload)'
```

### Các loại lỗi cần nhận biết

| Log | Nghĩa |
|-----|-------|
| `Container called exit(1)` | App crash khi khởi động |
| `WRONGPASS` | Sai Redis password |
| `Invalid Redis URL` | Format URL sai |
| `Stream isn't writeable` | Redis chưa connect khi gọi command |
| `Default STARTUP TCP probe failed` | App không listen đúng port |

---

## 10. CORS — tại sao web không gọi được backend

CORS (Cross-Origin Resource Sharing) là cơ chế browser bảo vệ người dùng. Khi web app ở domain A gọi API ở domain B, browser block nếu server B không cho phép.

**Fix:** Backend phải trả header `Access-Control-Allow-Origin: https://your-frontend.com`.

Trong dự án này, chat-service cần biết Vercel URL để whitelist. Dùng env var:
```yaml
ALLOWED_ORIGINS=https://platform-web.vercel.app,https://localhost:3000
```

---

## 11. Tóm tắt stack và khi nào dùng gì

| Công nghệ | Dùng khi nào |
|-----------|-------------|
| REST API | CRUD bình thường, không cần realtime |
| WebSocket/STOMP | Realtime: chat, notification, live data |
| Redis pub/sub | Service-to-service messaging nhanh, không cần persist |
| Redis cache | Lưu tạm dữ liệu hay đọc (OTP, session, cache) |
| JWT | Authentication stateless |
| Docker | Đóng gói app, chạy giống nhau mọi môi trường |
| Cloud Run | Deploy container không cần quản lý server |
| Vercel | Deploy Next.js nhanh, có edge network |
| GitHub Actions | Tự động hóa build/test/deploy |
