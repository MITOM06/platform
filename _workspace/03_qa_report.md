## QA Report — TASK-10 (Vision / image understanding in KB + chat) — 2026-06-23

### Verdict: **PASS**

All builds and the targeted/relevant tests pass on every layer. The new `AiHistoryEntry`
contract is field-for-field identical between chat-service (Java record) and ai-service
(TS interface). Chat vision wiring, KB vision wiring, and the graceful-degradation gates are
real and verified by reading the code (not just the reports). Web + mobile genuinely need no
change and the image-upload + `@AI`-mention + `type:"ai"`/`type:"image"` render path is intact
and in sync. The acceptance flow (invoice screenshot → "what's the total?") is wired end-to-end.

---

### Build status (EXACT output captured by QA — not trusting reports)

| Service | Command | Result |
|--------|---------|--------|
| ai-service build | `pnpm --filter ai-service build` | ✓ `nest build` — no errors |
| ai-service test | `pnpm --filter ai-service test` | ✓ **Test Suites: 34 passed, 34 total; Tests: 299 passed, 299 total** (4.889 s) |
| web build | `pnpm --filter @platform/web build` | ✓ `Compiled successfully in 2.1s`, 38/38 static pages, 0 errors |
| flutter analyze | `cd apps/client && flutter analyze` | ✓ **No issues found! (ran in 3.0s)** |
| flutter test | `cd apps/client && flutter test` | ✓ **All tests passed! (+47)** — BOTH analyze AND test were run (no stale-test repeat) |
| chat-service compile | `mvn -q compile` (system Maven, no mvnw) | ✓ exit 0, clean |
| chat-service targeted test | `mvn -q -Dtest=MessageServiceTest test` | ✓ **Tests run: 32, Failures: 0, Errors: 0, Skipped: 0** (surefire report) — incl. new TASK-10 image-history test `getAiHistory_ImageMessage_CarriesTypeAndImageUrls` and the backward-compat `getAiHistory_ExcludesNonTextTypes_AndMapsBotToAssistant` (asserts text turn `type()` is null) |

**chat-service full-suite note (documented precisely):** `mvn -q -Dtest='MessageService*,*AiHistory*' test`
glob also pulls in **`MessageServicePaginationTest`**, which is a Testcontainers integration test —
it errored with `IllegalState: Could not find a valid Docker environment` because Docker/Mongo infra
is not running in this QA environment. This is **environmental, NOT a TASK-10 regression** (that test
predates TASK-10 and exercises pagination via a real Mongo container). The TASK-10-touching unit test
class `MessageServiceTest` runs fully without infra and passes 32/32. There is no separate
`*AiHistory*` test **class** — the AiHistory coverage lives as test methods inside `MessageServiceTest`
(and `ChatControllerTest`, which references `AiHistoryEntry`). chat-service **COMPILES** and the
targeted unit tests **PASS**.

---

### CRITICAL CHECK 1 — `AiHistoryEntry` contract parity (TS vs Java)

`apps/server/ai-service/src/ai/ai.service.ts:32-37` vs
`apps/server/chat-service/.../dto/AiHistoryEntry.java`

| Field | chat-service (Java record) | ai-service (TS interface) | Match |
|-------|----------------------------|---------------------------|-------|
| `role` | `String role` | `role: 'user' \| 'assistant'` | ✓ (Java widens to String; values produced are `"user"`/`"assistant"` only) |
| `content` | `String content` | `content: string` | ✓ |
| `type` | `String type` (null for text) | `type?: string` (optional) | ✓ |
| `imageUrls` | `List<String> imageUrls` (null for text) | `imageUrls?: string[]` (optional) | ✓ |

- **JSON keys** are identical: `role`, `content`, `type`, `imageUrls`. Wrapper `AiRequestPayload`
  fields line up too (`conversationId, userId, displayName, content, history, departmentId`).
- **Backward compatibility:** chat-service uses the default `Jackson2JsonMessageConverter`
  (`RabbitMqConfig.java:55`) with **no `@JsonInclude(NON_NULL)`** — so text turns serialize as
  `{"role":..,"content":..,"type":null,"imageUrls":null}`. This is still backward compatible
  because ai-service guards on **`h.type === 'image'`** (`ai.service.ts:281`, `:427`) and
  `(h.imageUrls?.length ?? 0) > 0` — a `null` type/imageUrls is treated exactly as a plain text
  turn (`out.push({ role, content: h.content })`, `ai.service.ts:435`). The Java doc-comment's
  mention of `@JsonInclude(NON_NULL)` is aspirational (not actually applied), but it does not
  affect correctness — confirmed by the green test `getAiHistory_ExcludesNonTextTypes...` which
  asserts `history.get(0).type()` is null for a text turn. **No drift. Not a P1.**
- **`getAiHistory` emits image turns correctly** (`MessageService.java:478-483`): image rows are
  no longer flattened to a URL string — they emit `AiHistoryEntry.image(role, "", imageUrls)`
  (`type:"image"` + parsed `imageUrls`, empty caption). `parseImageUrls` (`:502-518`) handles
  both a single URL and a JSON array (`startsWith("[")` → Jackson `List<String>`, else single
  URL), dropping blanks — mirroring web's `parseImageUrls` and Flutter's `_parseUrls`. Text turns
  stay backward compatible (`@AI` strip + 20-entry cap + `assistant`/`user` role mapping preserved).

**Parity verdict: ✓ field-for-field match, backward compatible. No P1.**

---

### CRITICAL CHECK 2 — Chat vision wiring (verified in code)

- **Server-side fetch → base64 → image blocks** (`chat-image.service.ts`): `resolveImageBlocks`
  resolves relative `/api/uploads/{id}` against `config.chat.internalUrl` (default
  `http://localhost:8080`), authless `fetch` (same pattern KB uses), `arrayBuffer` → `Buffer`.
- **Media-type enforcement** (`:74-81`): infers from `Content-Type`, falls back to URL extension;
  validates via `VisionDescribeService.toSupportedImageMediaType` → **jpeg|png|gif|webp ONLY**;
  unsupported → skip (null), logged.
- **Size cap** (`:68-71`): `buffer.byteLength > maxImageBytes` (~5MB, `CHAT_VISION_MAX_IMAGE_BYTES`) → skip.
- **Count cap** (`:46`): `imageUrls.slice(0, this.maxImages)` (`CHAT_VISION_MAX_IMAGES`, default 4).
- **Fail-soft** (`:50-52`, `:43`): per-image try/catch skips bad ones; disabled/empty → `[]`. A
  text-only answer always remains possible.
- **`_agenticLoop` renders image turns** (`buildHistoryMessages`, `ai.service.ts:422-439`): image
  turn → `content = [...imageBlocks, {type:'text', text:caption?}]` — **image blocks BEFORE text**
  per the claude-api constraint; turns that resolve to nothing with empty caption are dropped
  (never an empty `content` array); text turns map to a plain string (byte-identical).
- **Force vision-capable model** (`:279-287`): if any history turn carries images, `selectedModel`
  is overridden to `primaryModel` (`claude-opus-4-8`) — confirmed at runtime by the test log line
  `Forcing primary model test-primary (was claude-haiku-4-5) — image turn present`.
- **Response cache gated for image turns** (`:497-499`, `:634-642`): `hasImages` inspects the
  actually-built message blocks; cache `store` only fires when `!hasImages` (plus no tools / no
  RAG / no web sources) — image-grounded answers are never cached.

**Chat vision verdict: ✓ all present and correct.**

---

### CRITICAL CHECK 3 — KB vision wiring + graceful degradation (verified in code)

- **Routing** (`kb-processor.service.ts:135-177`, `resolveText`): `visionUsable =
  visionEnabled && visionDescribe.isAvailable()`.
  - image/* + vision-supported + usable → `describeImage` → indexed text (`:140-143`).
  - PDF whose `extractText` (pdf-parse) result `< KB_VISION_MIN_TEXT_CHARS` (default 64) +
    `KB_VISION_PDF_ENABLED` → `describePdf` whole-document block (`:160-174`).
  - everything else → `extractText` as before (`:153`, `:157`) → zero extra cost on normal text.
  - Indexed via the **unchanged** chunk → embed → ensureCollection → upsert path (`:74-88`).
- **`VisionDescribeService`** (verified): `describeImage`/`describePdf` use non-streaming
  `messages.create` with one image/`application/pdf` document block before the transcribe prompt;
  validates media type ∈ {jpeg,png,gif,webp} + ~5MB cap; throws `VisionUnsupported`/`Oversized` so
  the caller degrades; **disabled (no Anthropic client, `isAvailable()===false`) when
  `ANTHROPIC_API_KEY` is unset**.
- **Graceful degradation (real & verified):**
  - `KB_VISION_ENABLED=false` → `visionEnabled` false → always `extractText` (today's behavior).
  - no key → `isAvailable()` false → `visionUsable` false → `extractText`.
  - vision error/empty (image) → caught (`:145-149`), falls through to `extractText` (throws for
    images ⇒ doc marked `error` — prior behavior).
  - vision error/empty (sparse PDF) → caught (`:171-173`), returns the sparse `text` it has.
  - unsupported mime (heic/bmp/svg) → `isVisionSupportedImage` false → `extractText`.
  - The whole `process` body is wrapped in try/catch (`:105-121`) marking the doc `error` +
    publishing `KB_ERROR` — **a vision failure NEVER crashes the KB pipeline.**

**KB vision verdict: ✓ gate + degradation are real.**

---

### CRITICAL CHECK 4 — Clients (web + mobile): verification-only confirmed

- **No source changes** on web or mobile (both reports + spot-check agree). The flow rides
  existing behavior; sync (`.claude/rules/sync.md`) is preserved.
- **Image upload (single URL vs JSON array)** identical on both: web
  `use-file-attachments.ts:33-34` (`images[0]` or `JSON.stringify(images)`) ↔ Flutter
  `chat_screen_helpers.dart:122` (`urls.length == 1 ? urls.first : jsonEncode(urls)`) — exactly the
  shape chat-service `parseImageUrls` decodes.
- **`@AI` trigger** identical text-based regex: web `page.tsx` `@(AI|ponai)` ↔ Flutter
  `chat_provider.dart:291` `RegExp(r'@(AI|ponai)\b')`. No caption field (matches DEFERRED scope).
- **`type:"image"` render**: web `MessageBubble.tsx:241` → `ImageContent` ↔ Flutter
  `message_bubble.dart:204-205` → `ImageContent`. **`type:"ai"` render**: web
  `MessageBubble.tsx:259` ↔ Flutter streaming/finalized AI bubble. No new message type, no new
  STOMP event → clients stay in sync with zero new handling.
- **i18n:** no new ARB/`messages` keys added (no UI strings) — correctly nothing to verify across
  the 7 locales; the optional input hint was correctly NOT added on one platform only.

**Client verdict: ✓ genuinely verification-only, in sync.**

---

### Acceptance criterion (reasoned — can't run live without Docker/Anthropic infra)

Invoice screenshot → "what's the total?": **wiring supports it end-to-end.**
1. Client uploads image → `type:"image"` message with `/api/uploads/{id}` in `content`.
2. User sends `@AI what's the total?` (separate text message).
3. chat-service `getAiHistory` includes the image message as
   `AiHistoryEntry.image("user", "", ["/api/uploads/{id}"])` and the text turn (`@AI` stripped).
4. ai-service `buildHistoryMessages` → `ChatImageService` fetches + base64-encodes the image into
   an image block (before any caption); `hasImageTurn` forces `claude-opus-4-8` (vision-capable).
5. The vision model answers; the `type:"ai"` stream renders on both clients.
   Confirmed each leg exists in code. Live numeric correctness needs Anthropic API + running infra.

---

### Issues found

| Severity | File:line | Finding | Recommendation |
|----------|-----------|---------|----------------|
| Info (none P1/P2) | `dto/AiHistoryEntry.java:9` | Doc-comment claims `@JsonInclude(NON_NULL)` but no such annotation is applied; text turns serialize `type:null,imageUrls:null`. Harmless (ai-service guards on `type==='image'`). | Optional: add `@JsonInclude(JsonInclude.Include.NON_NULL)` to slim the payload, or fix the comment. Not blocking. |
| Env (expected) | QA environment | `MessageServicePaginationTest` (Testcontainers) errored — no Docker. Pre-existing integration test, unrelated to TASK-10. | Run the full chat-service suite in a CI/infra env with Docker before release. |

No P1 / P2 issues. No cross-platform drift. No contract drift.

---

### Owner action items

1. **`KB_VISION_ENABLED` / `KB_VISION_PDF_ENABLED` / `CHAT_VISION_ENABLED` default to TRUE**
   (gates are `process.env.X !== 'false'`). Vision will be **active in any environment that has
   `ANTHROPIC_API_KEY` set**. To keep it off, set the flag(s) to `false` explicitly.
2. **`ANTHROPIC_API_KEY` is required** for any vision to work. Without it,
   `VisionDescribeService.isAvailable()` is false → KB silently degrades to today's behavior, and
   the chat agentic loop (which already needs the key) won't have vision. Ensure the key is set in
   prod (it was previously noted unset in prod for embeddings — same key powers vision).
3. **Vision cost note:** vision fires on (a) KB image uploads, (b) sparse/scanned PDFs
   (`< KB_VISION_MIN_TEXT_CHARS=64`), and (c) any chat turn carrying images — which **forces
   Opus (`claude-opus-4-8`)** regardless of router tier. Full-res images cost ~1.6k–4.7k+ image
   tokens each (capped 4/turn, ~5MB each). Normal text traffic is untouched (zero extra cost).
   Monitor token usage after enabling; tune `CHAT_VISION_MAX_IMAGES` / `KB_VISION_MIN_TEXT_CHARS`
   if cost runs hot. `CHAT_INTERNAL_URL` must point at the chat-service host so relative
   `/api/uploads/{id}` history refs resolve in prod (defaults to `http://localhost:8080`).
4. **Run the chat-service full suite in CI** (with Docker) to cover `MessageServicePaginationTest`
   before release — it could not run in this QA sandbox.
