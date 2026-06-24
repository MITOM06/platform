## Web Implementation Report — TASK-10 (Vision / image understanding)

### Verdict
**NO web change required** — the plan (`_workspace/01_plan.md`, Web section lines 51–56) is correct.
TASK-10 rides entirely on existing web behavior (image upload + `@AI` text + `type:"ai"` rendering).
This pass was **verification only**. No source files modified, no i18n keys added.

---

### What was verified (file:line evidence)

**1. User can attach/upload an image and it reaches the AI assistant**
- Image picker uploads to GridFS and sends an `image` message:
  - `apps/web/lib/hooks/use-file-attachments.ts:26` — `chatService.uploadFile(file)` → GridFS URL.
  - `:33` single image → `onSend(images[0], 'image')`; `:34` multiple → `onSend(JSON.stringify(images), 'image')` (URL or JSON-array — exactly the shape the plan's `parseImageUrls` / chat-service `getAiHistory` decodes, plan line 44/55).
  - Picker wired in `apps/web/components/chat/MessageInput.tsx:93` (`useFileAttachments`) and the file input `accept="image/*,video/*"` at `:274`.
- `@AI` trigger is **text-based and a SEPARATE message** (matches plan line 25 "two messages, no caption field"):
  - `apps/web/app/(main)/conversations/[id]/page.tsx:420-422` — in an AI conversation a text message is auto-prefixed `@AI `; `:427` also detects an explicit `@(AI|ponai)` mention in groups.
- Both the image message and the `@AI` text message are sent through the **same** path:
  - `page.tsx:432` → `chatService.sendMessage(id, finalContent, type, replyId)` → `apps/web/lib/api/chat.ts:164` `POST /api/messages`.
- Result: the image is persisted as a normal `image` message in the conversation. chat-service `getAiHistory` includes `image` messages in the AI history (per plan line 25/44) — so when the user then sends `@AI what's the total?`, the image-bearing prior turn is in `history`. The image→AI flow works with **zero web change**, server-side only.

**2. AI answer (`type:"ai"`) renders normally**
- `apps/web/components/chat/MessageBubble.tsx:259-290` — `case 'ai'`: renders the streamed answer as `whitespace-pre-wrap` text, with sentinel handling (`__AI_ERROR__`, `__AI_QUOTA__`, `__AI_INTERRUPTED__`, `__AI_UNAVAILABLE__`). Sources + 👍/👎 feedback at `:352`/`:360`. Already fully handled.

**3. Uploaded image messages render in the thread**
- `MessageBubble.tsx:241-242` — `case 'image'` → `<ImageContent content={message.content} />`; `image` is in `BARE_TYPES` (`:60`) so it renders without the colored bubble (Flutter parity).
- `apps/web/components/chat/ImageContent.tsx` — `parseImageUrls(content)` handles both a single URL and a `JSON.stringify(images)` array, `absoluteMediaUrl()` resolves GridFS URLs, with collage grid + lightbox. Renders correctly.

---

### Was any change needed?
No. The optional input hint (plan line 56) was deliberately **not** added — it is documented as optional/deferred, and adding it on one platform would require adding it on the other with i18n ×7 (sync rule). No genuine gap blocks a user from asking the AI about an uploaded image.

### Build result
`pnpm --filter @platform/web build`
```
✓ Compiled successfully in 2.3s
✓ Generating static pages using 9 workers (38/38) in 148ms
```
0 errors, 0 type errors. (Only pre-existing unrelated workspace warnings: pnpm `onlyBuiltDependencies` field notice, FirebaseFunctions node-engine warning.)

### i18n added keys
None (no UI change).

### Flutter mirror file sync confirmation (.claude/rules/sync.md)
- Image send: `use-file-attachments.ts:33-34` ↔ `apps/client/lib/features/chat/ui/chat_screen_helpers.dart:125` (`sendMessage(content, type: 'image')`) — ✓ both send `image` messages, same shape.
- `@AI` trigger: `page.tsx:420/427` regex `@(AI|ponai)` ↔ `apps/client/lib/features/chat/domain/chat_provider.dart:291` `_aiMentionRe = RegExp(r'@(AI|ponai)\b')` — ✓ identical.
- Image render: `MessageBubble.tsx:241` ↔ `apps/client/lib/features/chat/domain/chat_models.dart:394` (`isImage => type == 'image'`) + image_content widget — ✓.
- AI render: `MessageBubble.tsx:259` `type:"ai"` ↔ Flutter AI streamed message (`chat_ai_stream_handler.dart`) — ✓ both render as a normal AI message.
- No new message type, no new STOMP event → clients stay in sync with no new handling. ✓

### Confirmation
A web user CAN ask the AI about an uploaded image today: upload the image (becomes an `image` message → in AI history server-side), then send `@AI <question>` (text trigger). ai-service (per TASK-10 backend changes) renders the image-bearing history turn as an image content block and answers as a `type:"ai"` message, which `MessageBubble.tsx:259` already renders. End-to-end path verified at the web layer with no code change.

### 주의사항
- Web's image picker `accept="image/*,video/*"` (MessageInput.tsx:274) allows heic/bmp/svg etc. Filtering unsupported media types for vision is handled **server-side** in ai-service (`ChatImageService`, plan line 43/106) — correctly NOT a web concern, since those formats must still be sendable/renderable as plain image messages.
- The flow depends on the chat-service `getAiHistory` + ai-service `ChatImageService` backend changes landing (separate agents); web requires nothing further.
