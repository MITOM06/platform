# Plan: Security Hardening

> **Ngày:** 2026-07-03
> **Scope:** chat-service (Java) + connector-service (NestJS) + apps/web (Next.js) + plan fix nhỏ trong plan cũ
> **7 issues, thứ tự theo mức độ nghiêm trọng.**

---

## Issue 1 — SVG upload → Stored XSS

### Root cause

`FileValidationService.java` accept `image/svg+xml` (magic byte check chỉ kiểm tra ký tự `<`).
`UploadController.java` serve file với `Content-Type: image/svg+xml` → browser thực thi JS trong SVG.
`/api/uploads/**` là public (không cần auth) → bất kỳ ai có link đều trigger được.

### Fix 1a — `FileValidationService.java`: Loại SVG khỏi allowed images

Trong method `isAllowedImage()`, **xóa** dòng `|| isSvgOrXml(h)`:

```java
private boolean isAllowedImage(byte[] h) {
    return isJpeg(h)
        || isPng(h)
        || isGif(h)
        || isWebP(h)
        || isBmp(h)
        || isFtypBox(h);
    // SVG đã bị loại bỏ — SVG có thể chứa <script> và là XSS vector
}
```

Xóa luôn method `isSvgOrXml()` khỏi class (không còn dùng).

### Fix 1b — `UploadController.java`: Loại `image/svg+xml` khỏi resolveContentType

Trong method `resolveContentType()`, xóa dòng:
```java
if (lower.endsWith(".svg")) return "image/svg+xml";
```

### Fix 1c — `UploadController.java`: Defense-in-depth khi serve

Trong `getFile()`, trước khi build ResponseEntity, thêm check:

```java
// Block SVG khỏi inline render — serve as attachment để ngăn XSS
String storedTypeLower = mediaType.toString().toLowerCase();
if (storedTypeLower.contains("svg") || storedTypeLower.contains("xml")) {
    // Force download, không cho inline render
    disposition = "attachment; filename=\"" + resource.getFilename() + "\"";
    mediaType = MediaType.APPLICATION_OCTET_STREAM;
}
```

Đặt đoạn này SAU khi `mediaType` được resolve, TRƯỚC khi build `ResponseEntity.ok()`.

**Note:** Fix 1a+1b ngăn upload mới. Fix 1c là safety net cho các SVG đã lỡ lưu trước đó.

---

## Issue 2 — CORS wildcard default `*`

### Root cause

```yaml
# application.yml
app.cors.allowed-origins: ${ALLOWED_ORIGINS:*}
```

Default `*` + `allowCredentials(true)` = mọi origin đều đọc được authenticated API response nếu env var bị thiếu trong deployment.

### Fix — `application.yml`: Bỏ default, bắt buộc phải set env

```yaml
app:
  cors:
    # REQUIRED in production. No default — service fails fast if not set.
    # Local dev: set ALLOWED_ORIGINS=http://localhost:3000 in .env
    allowed-origins: ${ALLOWED_ORIGINS}
```

**Và** `SecurityConfig.java` — thêm validation khi start:

```java
@Value("${app.cors.allowed-origins}")
private String allowedOrigins;
```

Nếu `allowedOrigins` là blank hoặc `*` trong production environment, log WARNING rõ ràng:

```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    if (allowedOrigins == null || allowedOrigins.isBlank()) {
        throw new IllegalStateException(
            "ALLOWED_ORIGINS must be set. Refusing to start with open CORS.");
    }
    if ("*".equals(allowedOrigins.trim())) {
        log.warn("⚠️  CORS ALLOWED_ORIGINS='*' — only acceptable in local dev, NEVER in production");
    }
    // ... rest of existing code
}
```

**Thêm vào Cloud Run deploy** (trong CI/CD hoặc Google Cloud Console): set `ALLOWED_ORIGINS=https://platform-web-omega-amber.vercel.app`.

---

## Issue 3 — File URL dùng MongoDB ObjectId (có thể enumerate)

### Root cause

```java
var objectId = gridFsTemplate.store(file.getInputStream(), file.getOriginalFilename(), contentType);
String url = "/api/uploads/" + objectId.toString();
```

ObjectId encode timestamp + machine ID + counter → không truly random → attacker biết thời gian upload có thể thu hẹp search space.

### Fix — `UploadController.java`: Dùng random UUID làm storage key

```java
import java.util.UUID;

// Trong uploadFile():
// Thay vì dùng ObjectId return từ gridFsTemplate.store(), tạo UUID trước
String fileId = UUID.randomUUID().toString();  // cryptographically random, không enumerate được

// Store vào GridFS với UUID làm filename (để lookup sau)
// GridFS metadata: lưu thêm originalFilename + contentType
org.bson.Document metadata = new org.bson.Document()
    .append("fileId", fileId)
    .append("originalFilename", file.getOriginalFilename())
    .append("uploadedBy", principal.getUserId());

GridFSUploadOptions options = new GridFSUploadOptions()
    .chunkSizeBytes(255 * 1024)
    .metadata(metadata);

// Dùng GridFsTemplate.store() với metadata — hoặc dùng GridFSBucket trực tiếp
// Cách đơn giản nhất: store với filename = UUID, và lưu mapping trong metadata
gridFsTemplate.store(
    file.getInputStream(),
    fileId,          // ← dùng UUID làm filename trong GridFS
    contentType,
    metadata
);

String url = "/api/uploads/" + fileId;
```

**Và trong `getFile()`**: thay vì parse ObjectId, tìm bằng metadata fileId:

```java
@GetMapping("/{id}")
public ResponseEntity<Resource> getFile(@PathVariable String id, ...) {
    // Validate format (UUID hoặc legacy ObjectId đều chấp nhận trong transition period)
    // UUID pattern: 8-4-4-4-12 hex chars
    boolean isUuid = id.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    boolean isObjectId = id.matches("[0-9a-f]{24}");
    
    if (!isUuid && !isObjectId) {
        return ResponseEntity.notFound().build();
    }

    com.mongodb.client.gridfs.model.GridFSFile gridFSFile;
    
    if (isUuid) {
        // New files: lookup by metadata.fileId
        gridFSFile = gridFsTemplate.findOne(
            Query.query(Criteria.where("metadata.fileId").is(id)));
    } else {
        // Legacy files: lookup by ObjectId (backward compat)
        try {
            ObjectId objectId = new ObjectId(id);
            gridFSFile = gridFsTemplate.findOne(
                Query.query(Criteria.where("_id").is(objectId)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    if (gridFSFile == null) return ResponseEntity.notFound().build();
    // ... rest unchanged
}
```

**Lưu ý:** Backward compatible — file cũ vẫn serve được qua ObjectId, file mới dùng UUID. Không cần migration.

---

## Issue 4 — Virus scan là no-op

### Root cause

`NoOpVirusScanService` là default bean, không làm gì cả. Malware có thể được upload và distribute đến user khác.

### Fix — Block file type nguy hiểm (pragmatic approach)

Tích hợp ClamAV đòi hỏi infrastructure phức tạp. Giải pháp pragmatic hơn cho giai đoạn này: **block tất cả file type có thể execute**, giảm attack surface xuống gần bằng không.

**`FileValidationService.java`**: Thêm method `isExecutableExtension()` và gọi trong `validate()`:

```java
/** Extensions tuyệt đối không được upload — executable, script, hoặc có thể exploit. */
private static final Set<String> BLOCKED_EXTENSIONS = Set.of(
    // Windows executables
    "exe", "msi", "bat", "cmd", "com", "scr", "pif", "vbs", "vbe",
    "js", "jse", "ws", "wsh", "wsf", "ps1", "ps1xml", "ps2", "ps2xml",
    "psc1", "psc2", "msh", "msh1", "msh2", "mshxml", "reg", "inf",
    // Linux/Mac executables
    "sh", "bash", "zsh", "fish", "csh", "ksh", "run", "app", "dmg", "pkg",
    // Android/Java
    "apk", "jar", "class", "dex",
    // Office macros (high risk)
    "xlsm", "xlsb", "docm", "pptm", "xltm", "dotm", "potm", "ppam",
    // Other dangerous
    "hta", "cpl", "msc", "dll", "sys", "drv", "lnk"
);

private void validateExtension(MultipartFile file) {
    String name = file.getOriginalFilename();
    if (name == null) return;
    String ext = name.toLowerCase();
    int dot = ext.lastIndexOf('.');
    if (dot >= 0) ext = ext.substring(dot + 1);
    if (BLOCKED_EXTENSIONS.contains(ext)) {
        log.warn("Upload rejected [blocked-extension]: filename='{}', ext='{}'",
            file.getOriginalFilename(), ext);
        throw new BadRequestException(
            "File type '." + ext + "' is not allowed for security reasons.");
    }
}
```

Gọi `validateExtension(file)` làm bước ĐẦU TIÊN trong `validate()`, trước cả size check:

```java
public void validate(MultipartFile file, String resolvedContentType) throws IOException {
    validateExtension(file);     // ← Thêm vào đầu
    validateSize(file, resolvedContentType);
    validateMagicBytes(file, resolvedContentType);
}
```

**Lưu ý cho tương lai:** Khi scale lên, integrate ClamAV async: upload xong → mark file `status: scanning` → scan background → nếu clean thì `status: ready`, nếu infected thì xóa file + notify admin.

---

## Issue 5 — `InternalKeyGuard` dùng `!==` (không timing-safe)

### Root cause

```typescript
// internal-key.guard.ts
if (!expected || !provided || provided !== expected) {
```

Plain string comparison có thể bị timing attack — attacker đo response time để đoán key từng character.

### Fix — `connector-service/src/internal/internal-key.guard.ts`

```typescript
import { timingSafeEqual } from 'crypto';

// ...

canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const provided = req.headers?.['x-internal-key'];
    const expected = this.cfg.get<string>('internalApiKey');

    if (!expected || !provided) {
        throw new ForbiddenException('Invalid internal key');
    }

    // timingSafeEqual yêu cầu cùng length — nếu khác length thì dùng expected.length
    // để tránh leak length information qua timing
    const a = Buffer.from(provided.padEnd(expected.length));
    const b = Buffer.from(expected);
    
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new ForbiddenException('Invalid internal key');
    }
    return true;
}
```

---

## Issue 6 — Next.js thiếu security headers

### Root cause

`next.config.ts` không có `headers()` function. Browser không nhận X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS từ web app.

### Fix — `apps/web/next.config.ts`

Thêm `headers()` async function vào `nextConfig`:

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  images: { remotePatterns },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // HSTS — chỉ apply trên production (Vercel luôn HTTPS)
          // Next.js tự không thêm HSTS nên cần set thủ công
          ...(process.env.NODE_ENV === 'production'
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains; preload',
                },
              ]
            : []),
          // Content-Security-Policy cơ bản — không block inline style/script (shadcn dùng nhiều)
          // Expand này dần theo thời gian khi app stable hơn
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_CHAT_URL ?? ''} https://lh3.googleusercontent.com`,
              `connect-src 'self' ${process.env.NEXT_PUBLIC_AUTH_URL ?? ''} ${process.env.NEXT_PUBLIC_CHAT_URL ?? ''} ${process.env.NEXT_PUBLIC_AI_URL ?? ''} wss: ws:`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}
```

---

## Issue 7 — sessionStorage lưu password (fix plan cũ)

### Root cause

Plan `2026-07-02-auth-ui-and-bot-fixes.md` Issue 2 có đoạn:
```typescript
sessionStorage.setItem('pon:auth:prefill', JSON.stringify({ email, password, _ts }))
```

Lưu plaintext password trong sessionStorage — XSS có thể đọc được.

### Fix — `apps/web/app/(auth)/forgot-password/page.tsx`

Chỉ lưu email, **không lưu password**:

```typescript
// Thay: JSON.stringify({ email, password, _ts })
// Bằng:
sessionStorage.setItem(
    'pon:auth:prefill',
    JSON.stringify({ email, _ts: Date.now() }),  // ← bỏ password
)
```

### Fix — `apps/web/app/(auth)/login/page.tsx`

```typescript
const { email, _ts } = JSON.parse(raw) as { email: string; _ts: number }

// Chỉ set email, không set password
setValue('email', email, { shouldDirty: false })
// Không setValue('password', ...) nữa
// Password field để trống — user tự nhập
```

UX vẫn tốt: email tự điền, user chỉ cần nhập password mới vừa đặt. An toàn hơn nhiều.

---

## Verification

Sau khi implement, Claude Code chạy:

```bash
# Chat-service
cd apps/server/chat-service && mvn test

# Connector-service
cd apps/server/connector-service && pnpm test

# Web build
cd apps/web && pnpm build
```

Manual test:
1. Upload file `.svg` → nhận 400 "File type is not allowed"
2. Upload file `.exe` → nhận 400 "File type '*.exe' is not allowed for security reasons"
3. Upload `.jpg` bình thường → vẫn hoạt động
4. URL file mới là UUID format (36 chars) thay vì ObjectId (24 chars)
5. URL file cũ vẫn serve được (backward compat)
6. Browser DevTools → Network → kiểm tra response headers của web app có `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
7. Bắt đầu forgot-password flow → sau reset → vào login → chỉ email được pre-fill, password để trống

---

## Lưu ý cho Claude Code

- Issue 2 (CORS): **KHÔNG** thay đổi code nếu chưa đảm bảo `ALLOWED_ORIGINS` đã được set trong `.env` local và Cloud Run env vars. Check trước khi deploy.
- Issue 3 (UUID): File cũ không cần migrate. ObjectId lookup vẫn hoạt động song song.
- Issue 6 (CSP): CSP `'unsafe-inline'` + `'unsafe-eval'` là temporary — cần vì Next.js và shadcn inject inline styles. Đây là tradeoff chấp nhận được ở giai đoạn này. Sẽ tighten khi app stable.
- Issue 7: Đây là **sửa lại** code từ plan `2026-07-02-auth-ui-and-bot-fixes.md` Issue 2 — cần apply cả hai fix đồng thời (hoặc apply Issue 7 này SAU khi implement plan cũ).
