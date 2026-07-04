# Plan: Security Hardening — Round 2

> **Ngày:** 2026-07-03
> **Scope:** chat-service (Java) + ai-service (NestJS/TS) + auth-service (NestJS/TS)
> **3 issues.**

---

## Issue 1 — SSRF trong ai-service KB processor

### Root cause

`KbUploadRequest` không có validation nào:
```java
@Data
public class KbUploadRequest {
  private String conversationId;
  private String fileUrl;   // raw String — không @URL, không @NotBlank
  private String mimeType;
  private String fileName;
}
```

`KbController` publish `fileUrl` thẳng lên Redis → `kb-processor.service.ts` fetch mù:
```typescript
const response = await fetch(fileUrl);  // SSRF: attacker có thể pass http://169.254.169.254/...
```

Attacker là member hợp lệ → gửi `fileUrl: "http://169.254.169.254/latest/meta-data/"` → ai-service (chạy trên Cloud Run, có service account) fetch AWS/GCP metadata endpoint → lộ credentials.

### Fix 1a — `KbUploadRequest.java`: Thêm validation annotations

```java
package com.platform.chatservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class KbUploadRequest {

  @NotBlank
  private String conversationId;

  @NotBlank
  @Size(max = 1024)
  // Chỉ accept URL bắt đầu bằng /api/uploads/ (relative) hoặc http(s)://known-host/api/uploads/
  // Pattern này block hoàn toàn URL tới metadata endpoints, internal IPs, localhost
  @Pattern(
      regexp = "^/api/uploads/[0-9a-f\\-]{24,36}$"
          + "|^https?://[^/]*\\.run\\.app/api/uploads/[0-9a-f\\-]{24,36}$"
          + "|^http://localhost:\\d+/api/uploads/[0-9a-f\\-]{24,36}$",
      message = "fileUrl must point to a valid upload path")
  private String fileUrl;

  @NotBlank
  @Size(max = 127)
  private String mimeType;

  @Size(max = 255)
  private String fileName;
}
```

**Thêm `@Valid`** vào `KbController.java`:
```java
@PostMapping
public ResponseEntity<KbDocumentResponse> uploadDocument(
    @Valid @RequestBody KbUploadRequest request, Principal principal) throws JsonProcessingException {
```

### Fix 1b — `kb-processor.service.ts`: Validate fileUrl trước khi fetch

File: `apps/server/ai-service/src/kb/kb-processor.service.ts`

Thêm method validate ngay trước `fetch()`:

```typescript
/**
 * Validate fileUrl trước khi fetch để ngăn SSRF.
 * Chỉ cho phép URL trỏ đến chat-service upload endpoint.
 */
private validateFileUrl(fileUrl: string): void {
  // Allow relative paths (chỉ có thể xuất phát từ chat-service internal)
  if (fileUrl.startsWith('/api/uploads/')) return;

  let parsed: URL;
  try {
    parsed = new URL(fileUrl);
  } catch {
    throw new Error(`Invalid fileUrl: ${fileUrl}`);
  }

  // Block private/metadata IP ranges
  const { hostname } = parsed;
  const blocked = [
    '169.254.169.254',   // AWS/GCP/Azure metadata
    'metadata.google.internal',
    '100.100.100.200',   // Alibaba metadata
  ];
  if (blocked.includes(hostname)) {
    throw new Error(`SSRF blocked: fileUrl points to restricted host ${hostname}`);
  }

  // Block private IP ranges
  const privateRanges = [
    /^127\./,           // loopback
    /^10\./,            // RFC 1918
    /^172\.(1[6-9]|2\d|3[01])\./,  // RFC 1918
    /^192\.168\./,      // RFC 1918
    /^::1$/,            // IPv6 loopback
    /^fd/,              // IPv6 ULA
  ];
  if (privateRanges.some((re) => re.test(hostname))) {
    // Exception: allow localhost trong development environment
    if (process.env.NODE_ENV !== 'production' && hostname === 'localhost') return;
    throw new Error(`SSRF blocked: fileUrl points to private IP ${hostname}`);
  }

  // Chỉ allow http/https scheme
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`SSRF blocked: scheme ${parsed.protocol} not allowed`);
  }

  // Chỉ allow path bắt đầu bằng /api/uploads/
  if (!parsed.pathname.startsWith('/api/uploads/')) {
    throw new Error(`SSRF blocked: fileUrl path must be /api/uploads/*, got ${parsed.pathname}`);
  }
}
```

Gọi ngay trước `fetch()`:
```typescript
// Trong handleKbProcess():
this.validateFileUrl(fileUrl);                          // ← THÊM VÀO ĐÂY
const response = await fetch(fileUrl);
```

---

## Issue 2 — Message content không có size limit (DoS)

### Root cause

`SendMessageRequest` là plain record không có constraint:
```java
public record SendMessageRequest(
    String conversationId, String content, String type, String replyToId) {}
```

`WebSocketConfig` không set frame/message size limit — Spring WebSocket default là 64KB/buffer nhưng không enforce ở application level.

### Fix 2a — `SendMessageRequest.java`: Thêm `@Size`

```java
package com.platform.chatservice.dto;

import jakarta.validation.constraints.Size;

public record SendMessageRequest(
    String conversationId,

    @Size(max = 10_000, message = "Message content must not exceed 10,000 characters")
    String content,

    String type,
    String replyToId) {

  public SendMessageRequest(String conversationId, String content, String type) {
    this(conversationId, content, type, null);
  }
}
```

10,000 chars (~10KB) là đủ cho mọi use case chat thực tế. Attacker không thể gửi message 50MB nữa.

### Fix 2b — `MessageController.java`: Thêm `@Valid`

Tìm endpoint nhận `SendMessageRequest` (qua REST — không phải STOMP), thêm `@Valid`:

```java
// Endpoint gửi message (HTTP POST):
public ResponseEntity<?> sendMessage(@Valid @RequestBody SendMessageRequest request, ...) {
```

### Fix 2c — `WebSocketConfig.java`: Set transport size limit

Thêm override `configureWebSocketTransport` để giới hạn STOMP frame size:

```java
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

@Override
public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
    registration
        .setMessageSizeLimit(64 * 1024)       // 64KB max per STOMP message
        .setSendBufferSizeLimit(512 * 1024)    // 512KB send buffer per session
        .setSendTimeLimit(20_000);             // 20s timeout nếu client nhận chậm
}
```

**Lưu ý:** 64KB cho STOMP frame là đủ vì content đã bị cap ở 10,000 chars (~10KB) bởi `@Size`. Frame overhead (headers, metadata) cần thêm buffer.

### Fix 2d — `EditMessageRequest` / các DTO khác

Kiểm tra và thêm `@Size(max = 10_000)` vào tất cả DTO có field `content` dạng String trong thư mục `dto/`. Dùng lệnh:
```bash
grep -rn "String content" apps/server/chat-service/src/main/java/com/platform/chatservice/dto/
```
Áp dụng `@Size(max = 10_000)` cho mọi field `content` tìm được.

---

## Issue 3 — OTP lưu plaintext trong MongoDB

### Root cause

```typescript
// users.service.ts
async updateOtp(userId: any, otp: string, expires: Date): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
        otpCode: otp,   // ← lưu "483921" thẳng
        otpExpires: expires,
    })
}
```

```typescript
// auth.service.ts
if (user.otpCode !== otp) { ... }  // ← plain string compare
```

OTP 6 số = 900,000 giá trị. Nếu DB bị dump, attacker offline brute-force tìm ra OTP active của bất kỳ user nào trong vài giây.

### Fix — `auth.service.ts` (auth-service): Hash trước khi lưu và compare

Thêm helper function ở đầu file (import `crypto` đã có sẵn trong Node):

```typescript
import { createHash } from 'node:crypto';

/** SHA-256 hash của OTP — one-way, nhanh hơn bcrypt và phù hợp cho short-lived token */
private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
}
```

**Tại mỗi chỗ lưu OTP** — tìm tất cả lời gọi `this.usersService.updateOtp(...)` trong `auth.service.ts` và hash trước khi truyền vào:

```typescript
// Trước:
await this.usersService.updateOtp(user._id, otp, expires);

// Sau:
await this.usersService.updateOtp(user._id, this.hashOtp(otp), expires);
```

Có 3 chỗ gọi `updateOtp` (forgotPassword, register unverified, resendOtp) — áp dụng cho tất cả.

**Tại chỗ compare OTP** — `verifyOtp()` và `resetPassword()`:

```typescript
// verifyOtp():
// Trước:
if (user.otpCode !== otp) {

// Sau:
if (user.otpCode !== this.hashOtp(otp)) {
```

```typescript
// resetPassword():
// Tìm chỗ verify OTP trước khi reset — áp dụng hashOtp tương tự
```

**Không cần thay đổi** `users.service.ts` hay schema — `updateOtp` vẫn nhận string, chỉ khác là giờ nhận hash thay vì raw OTP.

---

## Verification

```bash
# auth-service
cd apps/server/auth-service && pnpm test

# chat-service
cd apps/server/chat-service && mvn test

# ai-service
cd apps/server/ai-service && pnpm test
```

Manual test:
1. **SSRF**: POST `/api/kb/documents` với `fileUrl: "http://169.254.169.254/latest/meta-data/"` → nhận 400 validation error từ chat-service (không bao giờ tới ai-service).
2. **SSRF defense-in-depth**: Nếu bypass được chat-service validation, ai-service cũng throw error và không fetch.
3. **Message size**: Gửi message với content >10,000 chars → nhận 400. Gửi message bình thường → vẫn ok.
4. **OTP hash**: Làm forgot-password flow → OTP nhập đúng vẫn verify được. Nhập sai vẫn reject. Kiểm tra MongoDB document: `otpCode` bây giờ là 64-char hex string thay vì 6 số.

---

## Lưu ý cho Claude Code

- **Issue 1 regex pattern**: Pattern trong `@Pattern` annotation phải escape đúng cho Java string. Cụ thể `\.` trong Java annotation string là `\\.`. Claude Code nên test regex độc lập trước khi apply.
- **Issue 1 local dev**: Trong local dev, `fileUrl` thường là `http://localhost:8080/api/uploads/...` — pattern đã include localhost exception. Nếu port khác, adjust pattern.
- **Issue 3**: Sau khi deploy, OTP cũ trong DB (nếu có) sẽ là plaintext → mismatch khi compare hash. Nhưng OTP chỉ valid 5 phút → không cần migration. Chờ TTL tự expire là đủ.
- **Issue 3**: SHA-256 là đúng cho OTP (short-lived, rate-limited). Không dùng bcrypt cho OTP vì bcrypt chậm (deliberate) nhưng OTP đã được rate-limited ở tầng khác rồi.
