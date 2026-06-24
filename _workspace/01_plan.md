## Feature: TASK-10 — Vision / image understanding in KB + chat

### Summary
Give the assistant eyes. Two halves: (KB) when a KB upload IS an image (or a PDF page yields little/no extractable text), send the bytes to Claude vision to produce a text description and index that description as a normal chunk; (Chat) when a user attaches an image to an AI question, pass the image to the model as an image content block so it can answer "what's the total?" about an invoice screenshot. Both halves are gated by config (default on) and degrade gracefully. The model already configured in ai-service (`claude-opus-4-8`) is vision-capable.

> **MANDATORY for the backend implementation agent — load the `claude-api` skill BEFORE wiring any vision call.** Confirmed constraints from that skill (do not deviate):
> - Image content block shape: `{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg'|'image/png'|'image/gif'|'image/webp', data: <base64, NO newlines> } }`, or `{ type: 'image', source: { type: 'url', url } }`. Place image block(s) BEFORE the accompanying text block in the same user-turn `content` array.
> - Supported media types: **image/jpeg, image/png, image/gif, image/webp ONLY**. Reject/skip anything else (heic/heif/bmp/svg etc.) — degrade to text; sending an unsupported media_type returns a 400.
> - Size: cap base64 images at ~5MB each; per-image fidelity costs tokens (full-res ~1.6k–4.7k+ image tokens each). Skip/resize oversized images.
> - Vision-capable model: `claude-opus-4-8` (the configured `primaryModel`) supports `image_input`. The router's haiku/sonnet tiers — confirm vision support via the skill / Models API before routing a vision turn to them; if a turn carries images, **force the primary (Opus) model** rather than letting the router downgrade.
> - Use the standard `client.messages.create`/`.stream(...)` — image blocks are ordinary content, no beta header.

---

### KEY DECISIONS (resolved — not open)

**(1) KB — when to invoke vision + how page-images are obtained**
- **IN SCOPE:** direct **image uploads** (mime `image/*`). Today `DocumentExtractorService.extractText` throws `UnsupportedFileTypeException` for images → an uploaded screenshot/scan produces zero chunks and the doc errors. New: when the upload mime is a vision-supported image, fetch bytes → Claude vision → text description → index that description via the existing chunker + embedding + vector-store path.
- **IN SCOPE (sparse-text PDF, pragmatic):** after `pdfParse`, if extracted text is empty/sparse (< `KB_VISION_MIN_TEXT_CHARS`, default 64), the PDF is scanned/image-heavy. ai-service does NOT rasterize PDF pages today (only `pdf-parse` text + `mammoth`; no pdf→image lib). Rather than add a native rasterizer this pass, send the **whole PDF document block** via the SDK's native PDF support (`{ type:'document', source:{ type:'base64', media_type:'application/pdf', data } }`) asking Claude to transcribe/describe; index the transcription. Gate `KB_VISION_PDF_ENABLED` (default on) + page/size cap. **DEFERRED:** true per-page rasterize + per-page describe (page-number chunk metadata) when a rasterizer is added.
- **Cost gate:** vision only when (a) upload IS an image, or (b) PDF text is empty/sparse. Normal text PDFs/docx/txt untouched → zero extra cost. Master switch `KB_VISION_ENABLED` (default true); when false, behavior is exactly as today.
- **Graceful degradation:** any vision/API failure → log + fall back to current behavior (image: mark doc `error`; sparse PDF: index sparse text if any, else error). Never crash the processor.

**(2) Chat — image source format + how the attachment reaches ai-service**
- **Source format:** **base64 fetched server-side by ai-service.** ai-service fetches the GridFS media URL (`/api/uploads/{id}` resolved against chat-service base) → buffer → base64 → image block. Rationale: media is served behind `/api/uploads` on an internal host, so a public `url` source is unreliable; ai-service already does authless `fetch(fileUrl)` for KB (`kb-processor.service.ts:57`) against the same host — reuse that pattern (KB already proves these URLs are fetchable from ai-service).
- **How it reaches ai-service:** **carry image refs in `history` entries.** The `@AI` mention lives in the TEXT message; the image is a SEPARATE prior `image` message (clients send image and text as two messages — there is NO caption field on `SendMessageRequest`). chat-service `getAiHistory` already INCLUDES `image` messages (they are NOT in `AI_HISTORY_SKIP_TYPES`) but currently flattens them to the raw URL string. **Change:** history entries gain optional `type` + `imageUrls` so ai-service renders an `image` turn as image content block(s) instead of a useless URL string. ZERO client protocol change.

**(3) Config / cost gating / model**
- Env (add to `configuration.ts`): `KB_VISION_ENABLED` (true), `KB_VISION_PDF_ENABLED` (true), `KB_VISION_MIN_TEXT_CHARS` (64), `KB_VISION_MAX_IMAGE_BYTES` (5_000_000), `CHAT_VISION_ENABLED` (true), `CHAT_VISION_MAX_IMAGES` (4), `CHAT_VISION_MAX_IMAGE_BYTES` (5_000_000). Vision model = existing `config.anthropic.model` (`claude-opus-4-8`).
- When a chat turn carries >=1 image, **force the primary model** (override router downgrade) so the image block is accepted.

---

### Backend (NestJS ai-service — PRIMARY) + chat-service

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `apps/server/ai-service/src/kb/document-extractor.service.ts` | 수정 | Expose `isVisionSupportedImage(mime)` helper; route image mimes to vision instead of throwing (when vision enabled). Keep throwing for genuinely unsupported types when vision disabled. |
| `apps/server/ai-service/src/kb/vision-describe.service.ts` | 신규 | `describeImage(buffer, mime): Promise<string>` + `describePdf(buffer): Promise<string>`. **Loads claude-api skill constraints.** Non-streaming `anthropic.messages.create` with an image/document block + "transcribe & describe all text, numbers, tables, totals, visual content; plain text" prompt. Validate media_type ∈ {jpeg,png,gif,webp} + size cap; throw on unsupported/oversized so caller degrades. Inject `ConfigService`; reuse/construct `Anthropic` from `config.anthropic.apiKey`. Keep < 300 lines. |
| `apps/server/ai-service/src/kb/kb-processor.service.ts` | 수정 | After fetch: if `KB_VISION_ENABLED` and mime is image → `text = describeImage(...)`. Else extract as today; if PDF and `text.trim().length < KB_VISION_MIN_TEXT_CHARS` and `KB_VISION_PDF_ENABLED` → `text = describePdf(...)` (fallback to sparse text on failure). Then existing chunk→embed→upsert path unchanged. Wrap vision so failure degrades. |
| `apps/server/ai-service/src/kb/kb.module.ts` | 수정 | Provide `VisionDescribeService` (+ spec). |
| `apps/server/ai-service/src/config/configuration.ts` | 수정 | Add the `kb.vision*` and `chat.vision*` config from env above. |
| `apps/server/ai-service/src/ai/ai.service.ts` | 수정 | (a) Extend `AiRequestPayload.history` item to `{ role; content; type?: string; imageUrls?: string[] }`. (b) In `_agenticLoop` build messages: an image history entry maps to a user `MessageParam` with `content = [...imageBlocks, { type:'text', text }]`; non-image entries stay strings. (c) Resolve image refs via new `ChatImageService` (fetch→base64→validate, skip oversized/unsupported, cap count). (d) If any image block present, force `selectedModel = primaryModel`. (e) Also gate the deterministic response-cache store to skip when images were present. Keep <=300 lines — extract block-building to `chat-image.service.ts`. |
| `apps/server/ai-service/src/ai/chat-image.service.ts` | 신규 | `resolveImageBlocks(imageUrls: string[]): Promise<Anthropic.ImageBlockParam[]>` — resolve chat base, fetch each `/api/uploads/{id}`, infer media_type from `Content-Type`/ext, validate {jpeg,png,gif,webp} + size cap + `CHAT_VISION_MAX_IMAGES`, base64 (no newlines). Fail-soft (skip bad). Needs a chat-service base env to resolve relative URLs. |
| `apps/server/chat-service/.../service/MessageService.java` | 수정 | `getAiHistory`: stop flattening `image` messages to URL text. For `image` rows populate new fields `type` + `imageUrls` (single URL or JSON-array, mirroring web `parseImageUrls`); `content` = caption (usually empty). Keep the 20-entry cap. |
| `apps/server/chat-service/.../dto/AiRequestPayload.java` | 수정 (계약) | Introduce `AiHistoryEntry(String role, String content, String type, List<String> imageUrls)` record; `history` type becomes `List<AiHistoryEntry>`. JSON keys `role`,`content`,`type?`,`imageUrls?`. Backward compatible. |
| `apps/server/chat-service/.../service/AiRedisPublisher.java` | 수정 | `publishAiRequest` history param → `List<AiHistoryEntry>`. No topology change. |
| `apps/server/chat-service/.../controller/MessageController.java` & `ChatController.java` | 수정 | Update `getAiHistory`→`publishAiRequest` plumbing to the new history type (call sites ~line 57 / ~67). Stripped `@AI` text content unchanged. |

> **chat-service note:** the `@AI` trigger stays text-based. Acceptance flow: upload invoice screenshot (image message) → send `@AI what's the total?` → image is in history → ai-service renders it as an image block → model answers. No new STOMP event, no new message type, no client protocol change.

### Web (apps/web/) — minimal/none

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| (none required for acceptance) | — | Web already uploads images (`use-file-attachments.ts`: single URL or `JSON.stringify(images)`, type `image`) and sends `@AI` text. Image→AI flow works with zero web change. |
| `apps/web/components/chat/MessageInput.tsx` (optional) | 수정 | OPTIONAL hint "you can ask @AI about an image you sent". If added, i18n keys in `apps/web/messages/*.json` (all 7 locales). |

### Mobile (apps/client/) — minimal/none

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| (none required for acceptance) | — | Flutter already uploads images (URL(s) in `content`, type `image`) and sends `@AI` text. Same backend-driven flow → AI answer renders as a normal `type:"ai"` streamed message both clients already handle. KB image-understanding is fully server-side. |
| `apps/client/lib/features/chat/ui/widgets/chat_input_bar.dart` (optional) | 수정 | OPTIONAL hint mirroring web. If added, keys in all 7 `lib/l10n/app_*.arb` + `flutter gen-l10n`. |

> **Sync (.claude/rules/sync.md):** core change is backend-only, riding existing image-upload + `@AI`-text + `type:"ai"` rendering — web/mobile stay in sync with NO new message-type handling. If the optional input hint is added on one platform it MUST be added on both with i18n ×7 each.

---

### API Contract (FIXED — implement to this)

**Internal `ai.requests` RabbitMQ payload (chat-service → ai-service).** History entry gains optional image fields:
```jsonc
{
  "conversationId": "string",
  "userId": "string",
  "displayName": "string",
  "content": "string",                 // triggering text (@AI stripped)
  "departmentId": "string|null",
  "history": [
    { "role": "user", "content": "what's the total?" },
    { "role": "user", "content": "", "type": "image",
      "imageUrls": ["/api/uploads/665f...a1"] }   // NEW optional fields
  ]
}
```
- `type` (optional): present for `image` history turns. Absent ⇒ legacy text turn.
- `imageUrls` (optional): relative `/api/uploads/{id}` paths (JSON-array decoded). ai-service resolves against chat base, fetches, base64-encodes.
- Backward compatible: text entries omit `type`/`imageUrls`; ai-service treats them as plain text.

**Internal `kb:process` Redis payload — UNCHANGED.** Already carries `fileUrl` + `mimeType` + `fileName` — sufficient for KB vision. No new field.

**Claude vision call (both halves):** exact block shapes per the MANDATORY block at top.

### Data Model Changes
- `kb_documents` schema: **no required change.** (Optional follow-up: `extractionMode: 'text'|'vision-image'|'vision-pdf'` for observability.)
- `messages`: **no change** — image messages already store URL(s) in `content` with `type:"image"`.

### Implementation Order
1. **chat-service** (contract first): `AiHistoryEntry` record → `AiRequestPayload` → `getAiHistory` populates `type`/`imageUrls` → `AiRedisPublisher` + both controllers. `mvn -q -DskipTests compile`.
2. **ai-service KB half** (parallelizable): `configuration.ts` → `VisionDescribeService` (load claude-api skill) → wire `kb-processor` → `kb.module`. `pnpm build && pnpm test`.
3. **ai-service Chat half** (parallelizable with #2): extend history type → `ChatImageService` → `_agenticLoop` renders image turns + forces primary on images + cache-gate. `pnpm build && pnpm test`.
4. **Web + Mobile:** only if optional input hint added — then BOTH, i18n ×7 each. Otherwise no-op; verify flow.
5. **QA / acceptance:** upload invoice screenshot, send `@AI what's the total?`, confirm correct figure; upload scanned-invoice PDF to KB, confirm vision description indexed + retrievable.

### Edge Cases
- **Unsupported image type** (heic/heif/bmp/svg): media_type not in {jpeg,png,gif,webp} → skip image block (chat) / fall back to error or sparse text (KB). Clients DO allow heic/webp/bmp/svg uploads (`UploadController.resolveContentType`) — webp ok, the rest must be filtered.
- **Oversized image** (> ~5MB base64): skip with logged warning (no guaranteed image lib in ai-service; resize is a deferred follow-up).
- **Multiple images** in one turn (JSON array): cap at `CHAT_VISION_MAX_IMAGES` (4); extras dropped.
- **Image fetch fails** (GridFS 404 / network): skip that image, continue text-only — fail-soft.
- **Vision routed to haiku/sonnet:** force primary (Opus) for any turn with image blocks; never route to a model with unconfirmed vision support.
- **KB sparse-PDF false positive** (legit short text PDF): `KB_VISION_MIN_TEXT_CHARS=64` is conservative; on vision failure the sparse text still indexes — no regression.
- **Cost runaway:** vision only fires on image uploads / sparse PDFs (KB) and image-bearing turns (chat); normal text traffic untouched. All config-gated, default on, env-disablable.
- **Prompt cache:** image blocks live in `messages` (after cached system/tools prefix) → don't bust persona/tool cache.
- **Response cache:** add "no images this turn" to the deterministic-cache gate in `_agenticLoop` (alongside no tool calls / no RAG / no web sources).
- **i18n:** if optional hints added, every new string in all 7 locales on BOTH platforms.

### Explicitly IN scope this pass vs DEFERRED
- **IN:** direct image-upload KB describe+index; sparse/scanned PDF whole-document vision transcription; chat image attachments → image content blocks (base64, server-fetched); config gating + graceful degradation; force-primary-model-on-images.
- **DEFERRED (documented follow-up):** per-page PDF rasterization with page-number chunk metadata (rasterizer dep); server-side image downscale/resize for oversized images; inline image caption in the SAME message as `@AI` (needs a caption field on `SendMessageRequest`); `extractionMode` observability field; optional client input hints (do both-or-neither if attempted).
