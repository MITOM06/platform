# Backend Implementation Report — TASK-10 (Vision / image understanding)

Implemented the full TASK-10 backend (no prior feature code existed; only build-infra
+ plan were committed) across both ai-service halves plus the chat-service contract change.

## What was built — per half

### A. KB half (ai-service `src/kb/`)
- **`VisionDescribeService` (NEW)** — `describeImage(buffer, mime)` + `describePdf(buffer)`.
  Non-streaming `anthropic.messages.create` with one image/document content block before a
  transcribe-and-describe text prompt, per the claude-api skill: image block
  `{type:'image', source:{type:'base64', media_type, data}}`, PDF document block
  `{type:'document', source:{type:'base64', media_type:'application/pdf', data}}`. Validates
  media type ∈ {jpeg,png,gif,webp} + the ~5MB byte cap, throws `VisionUnsupportedException` /
  `VisionOversizedException` so the caller degrades. Vision model = `config.anthropic.model`
  (`claude-opus-4-8`, vision-capable). Disabled (no client) when `ANTHROPIC_API_KEY` is unset.
- **`DocumentExtractorService`** — added `isVisionSupportedImage(mime)` and `isImage(mime)`
  helpers; still throws `UnsupportedFileTypeException` for images (the processor routes images
  to vision *before* calling `extractText`, so the throw is the graceful-degradation path).
- **`KbProcessorService`** — new private `resolveText(buffer, mime)` runs after fetch:
  - image/* + vision-supported + enabled ⇒ `describeImage` → indexed text;
  - PDF whose `pdf-parse` text `< KB_VISION_MIN_TEXT_CHARS` + `KB_VISION_PDF_ENABLED` ⇒
    `describePdf` (falls back to the sparse text on failure);
  - everything else ⇒ `extractText` as before.
  Fully gated + fail-soft: a vision error never crashes the pipeline (image → falls back to
  the prior error path; sparse PDF → indexes whatever sparse text it has). Existing
  chunk→embed→upsert path is unchanged.
- **`kb.module.ts`** — provides `VisionDescribeService`.

### B. Chat half (ai-service `src/ai/`)
- **`AiRequestPayload.history`** element is now the structured **`AiHistoryEntry`**
  (see contract below). `ChatImageService` (NEW) resolves a turn's `imageUrls` → base64
  image blocks: resolves relative `/api/uploads/{id}` against the chat host, fetches authless
  (same pattern KB uses), infers media_type from `Content-Type` (falls back to URL ext),
  validates {jpeg,png,gif,webp} + size cap + `CHAT_VISION_MAX_IMAGES`. Fail-soft (skips bad).
- **`ai.service.ts`** — `buildHistoryMessages` maps an image turn to a user `MessageParam`
  with `content = [...imageBlocks, {type:'text', text:caption}]` (images BEFORE text, per the
  vision constraint); text turns stay plain strings (byte-identical). When any history turn
  carries images, the router selection is **overridden to the primary model** (`claude-opus-4-8`)
  so image blocks never reach an unconfirmed-vision tier. The deterministic response-cache store
  is gated to skip when images were present. An image turn that resolves to nothing (all skipped)
  and has an empty caption is dropped (never an empty `content` array).
- **`ai.module.ts`** — provides `ChatImageService`.
- **`configuration.ts`** — added `kb.vision*` + `chat.vision*` + `chat.internalUrl`.

### C. chat-service (Java / Spring Boot)
- **`AiHistoryEntry` (NEW record)** + `AiRequestPayload.history` → `List<AiHistoryEntry>`.
- **`MessageService.getAiHistory`** no longer flattens image messages to a URL string: image
  rows emit `type:"image"` + `imageUrls` (parsed from content — single URL or JSON array,
  mirroring web `parseImageUrls`), caption empty; text rows unchanged (`@AI` strip preserved,
  20-entry cap kept). New `parseImageUrls` helper.
- **`AiRedisPublisher.publishAiRequest`** + **`MessageController`** / **`ChatController`** call
  sites updated to the new history type. No topology change, no new HTTP endpoint.

## Files changed
### ai-service
- `apps/server/ai-service/src/config/configuration.ts` — vision config (kb + chat)
- `apps/server/ai-service/src/kb/vision-describe.service.ts` — NEW
- `apps/server/ai-service/src/kb/vision-describe.service.spec.ts` — NEW
- `apps/server/ai-service/src/kb/document-extractor.service.ts` — vision helpers
- `apps/server/ai-service/src/kb/document-extractor.service.spec.ts` — helper tests
- `apps/server/ai-service/src/kb/kb-processor.service.ts` — `resolveText` routing
- `apps/server/ai-service/src/kb/kb-processor.vision.spec.ts` — NEW (routing/degradation)
- `apps/server/ai-service/src/kb/kb.module.ts` — provide VisionDescribeService
- `apps/server/ai-service/src/ai/chat-image.service.ts` — NEW
- `apps/server/ai-service/src/ai/chat-image.service.spec.ts` — NEW
- `apps/server/ai-service/src/ai/ai.service.ts` — AiHistoryEntry, image blocks, force-primary, cache gate
- `apps/server/ai-service/src/ai/ai.service.spec.ts` — image-history tests + ctor mock
- `apps/server/ai-service/src/ai/ai.module.ts` — provide ChatImageService
- `apps/server/ai-service/.env.example` — vision env vars
### chat-service
- `apps/server/chat-service/.../dto/AiHistoryEntry.java` — NEW record
- `apps/server/chat-service/.../dto/AiRequestPayload.java` — history → List<AiHistoryEntry>
- `apps/server/chat-service/.../service/MessageService.java` — getAiHistory + parseImageUrls
- `apps/server/chat-service/.../service/AiRedisPublisher.java` — history type
- `apps/server/chat-service/.../controller/MessageController.java` — call site
- `apps/server/chat-service/.../controller/ChatController.java` — call site
- `apps/server/chat-service/.../test/.../service/MessageServiceTest.java` — return-type + image tests

## API contract (FIXED — `ai.requests` RabbitMQ payload)
`history[]` element = `AiHistoryEntry`:
```jsonc
{ "role": "user"|"assistant", "content": "string",
  "type": "image",                       // OPTIONAL — present only for image turns
  "imageUrls": ["/api/uploads/665f..."]  // OPTIONAL — relative paths, JSON-array decoded
}
```
- Text turns omit `type`/`imageUrls` (byte-identical to before — backward compatible).
- Java record: `AiHistoryEntry(String role, String content, String type, List<String> imageUrls)`.
- TS interface: `{ role: 'user'|'assistant'; content: string; type?: string; imageUrls?: string[] }`.
- `kb:process` Redis payload UNCHANGED (already carries fileUrl/mimeType/fileName).

## Env / config added (configuration.ts; defaults shown)
- `KB_VISION_ENABLED=true`, `KB_VISION_PDF_ENABLED=true`, `KB_VISION_MIN_TEXT_CHARS=64`,
  `KB_VISION_MAX_IMAGE_BYTES=5000000`
- `CHAT_VISION_ENABLED=true`, `CHAT_VISION_MAX_IMAGES=4`, `CHAT_VISION_MAX_IMAGE_BYTES=5000000`
- `CHAT_INTERNAL_URL=http://localhost:8080` (resolves relative `/api/uploads/{id}` history refs)
- Vision model = existing `config.anthropic.model` (`claude-opus-4-8`)

## Constraints enforced (per claude-api skill)
- Media types: jpeg|png|gif|webp ONLY (heic/bmp/svg skipped/degraded).
- Per-image base64 cap ~5MB; oversized skipped with a logged warning.
- Image block placed BEFORE the accompanying text block in the user-turn content array.
- Image-bearing chat turns force the vision-capable primary model (never a haiku/sonnet tier).
- Graceful degradation everywhere — no key / disabled / vision error / unsupported / 404 ⇒
  fall back, never crash.

## Build / test results (EXACT)
- `pnpm --filter ai-service build` — ✓ (nest build, no errors)
- `pnpm --filter ai-service test` — ✓ **Test Suites: 34 passed, 34 total; Tests: 299 passed, 299 total**
- chat-service `mvn compile -q` — ✓ (clean, after `mvn spotless:apply`)
- chat-service `mvn test -Dtest=MessageServiceTest,ChatControllerTest,AiRedisPublisherTest` — ✓
  **Tests run: 39, Failures: 0, Errors: 0, Skipped: 0; BUILD SUCCESS**
  (includes 2 new image-history tests in MessageServiceTest)
- `@platform/database` — NOT touched (no build run needed).

## IN scope (this pass) vs DEFERRED
- **IN:** direct image-upload KB describe+index; sparse/scanned PDF whole-document vision
  transcription (native PDF document block); chat image attachments → image content blocks
  (base64, server-fetched); config gating + graceful degradation; force-primary-model-on-images;
  response-cache gate for image turns; the AiHistoryEntry contract change + Java publisher/controllers.
- **DEFERRED:** per-page PDF rasterization with page-number chunk metadata (no rasterizer dep);
  server-side image downscale/resize for oversized images (currently skipped); inline image
  caption in the SAME message as `@AI` (needs a caption field on `SendMessageRequest`);
  `extractionMode` observability field on `kb_documents`; optional client input hints (web/mobile).
