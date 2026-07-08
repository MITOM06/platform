# Plan: Fix AI Memory — Extraction Threshold + Slash Command Hallucination

> **Ngày:** 2026-07-08
> **Scope:** `apps/server/ai-service/src/ai/ai.service.ts` (chủ yếu)
> **2 bugs độc lập.**

---

## Bug 1 — Memory không bao giờ được extract vì threshold quá cao (20 turns)

### Root cause

`ai.service.ts` lines 400-408:
```typescript
const count = await this.memoryService.incrementMessageCount(conversationId);
if (this.extractEveryTurns > 0 && count % this.extractEveryTurns === 0) {
  this.factExtractor.extractFacts(conversationId, userId, loopHistory, count).catch(...)
}
```

`extractEveryTurns` mặc định là `20` (config default `MEMORY_EXTRACT_EVERY ?? '20'`). Extraction
chỉ chạy khi `count % 20 === 0` — tức là turn 20, 40, 60... Với user chat vài tin nhắn, memory
KHÔNG BAO GIỜ được lưu. Đây là root cause chính.

### Fix — `apps/server/ai-service/src/ai/ai.service.ts`

Tìm đoạn:
```typescript
try {
  const count = await this.memoryService.incrementMessageCount(conversationId);
  if (this.extractEveryTurns > 0 && count % this.extractEveryTurns === 0) {
    this.factExtractor.extractFacts(conversationId, userId, loopHistory, count).catch((err) => {
      this.logger.error(`Fact extraction failed for ${conversationId}`, err);
    });
  }
} catch (err) {
  this.logger.error(`Failed to increment message count for ${conversationId}`, err);
}
```

Thay thành:
```typescript
try {
  const count = await this.memoryService.incrementMessageCount(conversationId);
  // Extract facts:
  //   - Lần đầu: sau turn 3 (đủ context nhưng không chờ quá lâu)
  //   - Định kỳ: mỗi extractEveryTurns sau đó (default 10, không còn 20)
  const isFirstExtraction = count === 3;
  const isPeriodicExtraction = this.extractEveryTurns > 0 && count > 3 && count % this.extractEveryTurns === 0;
  if (isFirstExtraction || isPeriodicExtraction) {
    this.factExtractor.extractFacts(conversationId, userId, loopHistory, count).catch((err) => {
      this.logger.error(`Fact extraction failed for ${conversationId}`, err);
    });
  }
} catch (err) {
  this.logger.error(`Failed to increment message count for ${conversationId}`, err);
}
```

### Fix — `apps/server/ai-service/src/config/configuration.ts`

Đổi default `extractEveryTurns` từ `20` → `10`:
```typescript
// Tìm:
extractEveryTurns: parseInt(process.env.MEMORY_EXTRACT_EVERY ?? '20', 10),

// Thay thành:
extractEveryTurns: parseInt(process.env.MEMORY_EXTRACT_EVERY ?? '10', 10),
```

**Kết quả sau fix:**
- Turn 1, 2: chưa extract (chưa đủ context)
- Turn 3: **extract lần đầu** → memory xuất hiện trong `/ai-memory` page
- Turn 10, 20, 30...: extract định kỳ để refresh/update

---

## Bug 2 — `/ai-memory` slash command trả về hallucination thay vì data thật

### Root cause

`ai.service.ts` line 148 chỉ intercept duy nhất `/new`:
```typescript
if (payload.content.trim() === '/new') {
  await this.aiSessionService.createNewSession(userId, conversationId);
  await this.publishSystemResponse(conversationId, NEW_SESSION_NOTICE);
  return;
}
```

Khi user gửi `/ai-memory`, message được pass thẳng xuống Claude như text thường. Claude không có
memory data thật → **hallucinate** response dựa trên context trong conversation (Tên: Khang,
Developer, v.v.). Response trông có vẻ đúng nhưng là Claude đọc lại từ history, không phải từ DB.

### Fix — `apps/server/ai-service/src/ai/ai.service.ts`

Thêm handler cho `/memory` và `/ai-memory` sau handler của `/new`. Thêm hằng string ngoài class:

```typescript
// Thêm sau NEW_SESSION_NOTICE và CONTEXT_COMPACTED_NOTICE constants:
const MEMORY_EMPTY_NOTICE =
  '🧠 Chưa có ký ức nào được lưu trong cuộc trò chuyện này. Hãy chat thêm một chút để tôi học được về bạn.';
```

Thêm handler trong `handleRequest()`, ngay sau handler `/new`:

```typescript
// Đặt sau:
// if (payload.content.trim() === '/new') { ... }

// Thêm:
const trimmedContent = payload.content.trim();
if (trimmedContent === '/memory' || trimmedContent === '/ai-memory') {
  const memory = await this.memoryService.getMemory(conversationId);
  if (!memory || (!memory.summary && memory.keyFacts.length === 0)) {
    await this.publishSystemResponse(conversationId, MEMORY_EMPTY_NOTICE);
  } else {
    const factsText =
      memory.keyFacts.length > 0
        ? '\n\n**Thông tin đã ghi nhớ:**\n' +
          memory.keyFacts.map((f) => `• ${f}`).join('\n')
        : '';
    const notice =
      `🧠 **Ký ức của cuộc trò chuyện này (${memory.messageCount} tin nhắn):**\n\n` +
      `${memory.summary}` +
      factsText;
    await this.publishSystemResponse(conversationId, notice);
  }
  return;
}
```

**Lưu ý quan trọng về vị trí của code:**

Handler `/memory` phải được đặt TRƯỚC khi code check quota và rate limit vì đây là system
response, không tốn token. Đặt nó cùng block với `/new`:

```typescript
// Thứ tự trong handleRequest() phải là:
// 1. Access check
// 2. /new handler
// 3. /memory handler  ← thêm vào đây
// 4. Settings load
// 5. Quota check
// 6. Rate limit check
// 7. processRequest(...)
```

Cụ thể, tìm đoạn sau và chèn `/memory` handler xen vào:

```typescript
// Tìm (line ~148):
if (payload.content.trim() === '/new') {
  await this.aiSessionService.createNewSession(userId, conversationId);
  await this.publishSystemResponse(conversationId, NEW_SESSION_NOTICE);
  return;
}

// THÊM NGAY SAU:
if (payload.content.trim() === '/memory' || payload.content.trim() === '/ai-memory') {
  const memory = await this.memoryService.getMemory(conversationId);
  if (!memory || (!memory.summary && memory.keyFacts.length === 0)) {
    await this.publishSystemResponse(conversationId, MEMORY_EMPTY_NOTICE);
  } else {
    const factsText =
      memory.keyFacts.length > 0
        ? '\n\n**Thông tin đã ghi nhớ:**\n' +
          memory.keyFacts.map((f) => `• ${f}`).join('\n')
        : '';
    const notice =
      `🧠 **Ký ức của cuộc trò chuyện này (${memory.messageCount} tin nhắn):**\n\n` +
      `${memory.summary}` +
      factsText;
    await this.publishSystemResponse(conversationId, notice);
  }
  return;
}

// Rồi mới đến:
// Resolve workspace AI settings once (cached) and thread through the request.
const settings = await this.settingsService.getSettings();
```

---

## Verification

### Bug 1 (threshold fix):
1. Tạo conversation mới với AI bot.
2. Chat 3 tin nhắn (ví dụ: "Tao tên là Khang", "Tao làm developer", "Tao đang dùng NestJS + Flutter").
3. Đợi vài giây (extraction chạy background async).
4. Vào trang `/ai-memory` → thấy memory card với summary và facts xuất hiện.

### Bug 2 (slash command fix):
1. Trong conversation với AI bot, gửi tin nhắn `/memory`.
2. AI bot trả về response từ DB thật:
   - Nếu chưa có memory: "Chưa có ký ức nào..."
   - Nếu đã có: hiển thị summary + danh sách facts đã extract.
3. Response KHÔNG hallucinate — chỉ đọc từ `memoryService.getMemory()`.

---

## Lưu ý cho Claude Code

- **Bug 1**: Tìm đúng đoạn `count % this.extractEveryTurns === 0` và thay TOÀN BỘ condition `if (...)` như ở trên. Không được xóa `.catch()` error handler.
- **Bug 2**: `MEMORY_EMPTY_NOTICE` phải được khai báo ở module scope (cùng cấp với `NEW_SESSION_NOTICE`), không trong class.
- **Bug 2**: Dùng `payload.content.trim()` (đã trim), không cần trim lại trong điều kiện.
- **Bug 2**: `memoryService.getMemory()` có thể trả về `null` khi chưa có memory nào — handle cả 2 case (null và object rỗng).
- Sau khi sửa: `pnpm build` trong `apps/server/ai-service/` để verify TypeScript.
- Deployment: ai-service cần restart để pick up changes.
