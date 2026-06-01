# TODO — PON PROJECT
> **Workflow:** Gemini Code Assist (Planner/QC) ↔ Tech Lead (Bridge) ↔ Claude CLI (Coder/Tester)
> **Updated:** 2026-06-01
> **Note to Claude:** To save tokens, historical sprints (1-11) have been archived to `TODO_ARCHIVE.md`. Please read the following sprints and implement them sequentially when requested.

---

## 🔴 SPRINT 12 — Core Message Enhancements & Pagination — PENDING

### TASK 45 — Edit Message Feature `DONE`
#### SPEC
- **Data model (BE):** Add `editedAt` (Date/timestamp) to `Message` schema/model.
- **Backend:** Create `PUT /api/messages/{id}` endpoint to update `content` and set `editedAt`. Verify the user is the sender before updating. Broadcast the edited message via STOMP (`MESSAGE_UPDATED` event).
- **Frontend:** Implement long-press on a message bubble (sent by me) to show a context menu with "Edit". When selected, show the message in the input bar. Upon saving, call the PUT API. Display an `(edited)` text next to the timestamp for modified messages.
- **Test:** Edit a message, check if the UI updates instantly for both users and shows the edited tag.

### TASK 46 — General File Upload (PDF, DOC, ZIP) `PENDING`
#### SPEC
- **Backend:** Update `UploadController` to accept application formats (PDF, DOCX, ZIP, etc.), not just `image/*` and `video/*`. Ensure GridFS saves correct content types.
- **Frontend:** Integrate a file picker (e.g., `file_picker` package). In `ChatScreen`, add an attachment icon to pick general documents. Render a generic "File Bubble" (showing filename, size, and a download icon) instead of an image preview when the type is a document.
- **Test:** Upload a PDF file, verify the receiver sees the file card and can download it.

### TASK 47 — Cursor-based Pagination for Messages `PENDING`
#### SPEC
- **Backend:** Refactor `MessageService.getMessages` to use cursor-based pagination (e.g., passing `beforeMessageId` or `beforeTimestamp` instead of `page`). This prevents message jumping or duplication when new messages arrive while scrolling up.
- **Frontend:** Update `chat_repository.dart` and `ChatNotifier` to track the oldest `messageId` and pass it to the API during `loadMore()`.
- **Test:** Scroll up to load old messages while the other user sends new messages. Verify the scroll position is stable and no duplicate messages appear.

### TASK 48 — Link Preview (OG Unfurl) `PENDING`
#### SPEC
- **Frontend:** When rendering text messages containing URLs, parse the URL and fetch Open Graph (OG) metadata (title, description, thumbnail image). Use a package like `any_link_preview` or `flutter_link_previewer`. If CORS blocks client-side fetching, create a `GET /api/utils/link-preview?url=` in the Backend.
- **Test:** Send a link (e.g., youtube.com), verify a rich card preview appears below the text.

---

## 🔴 SPRINT 13 — Mentions, Search & Real Unread Counts — PENDING

### TASK 49 — Mention System (@username) `PENDING`
#### SPEC
- **Backend:** When a message is sent, parse the content for `@username`. Extract the mentioned users and send a specific priority push/STOMP notification to them (`MENTIONED_YOU`).
- **Frontend:** In `ChatScreen`, detect typing `@` and show a floating list of group members to auto-complete. Render `@username` in the message bubble with a distinct color (e.g., Cyan) and make it clickable to open their Profile.
- **Test:** Mention a user in a group chat, verify they get a specific mention notification and the text is highlighted.

### TASK 50 — Message Search `PENDING`
#### SPEC
- **Backend:** Create `GET /api/messages/search?q={query}&conversationId={id}`. Add a Text Index to the `content` field in MongoDB for efficient searching.
- **Frontend:** Add a search icon in the `ChatScreen` AppBar. Open a search bar, call the API, and display results in a list. Clicking a result jumps to that message.
- **Test:** Search for a specific word, get the result, and navigate to the message location.

### TASK 51 — Real Unread Count per Conversation `PENDING`
#### SPEC
- **Backend:** Add logic in `listConversations` to compute and return `unreadCount` for each conversation. (Compare the latest message timestamp/ID against the user's `readReceipt` mark).
- **Frontend:** Read the `unreadCount` from the API response and display a red badge (e.g., "3") on the conversation list item instead of just a generic dot.
- **Test:** Receive 5 messages while outside the chat. The list screen shows a red badge "5".

---

## 🔴 SPRINT 14 — Conversation Channels & Advanced Actions — PENDING

### TASK 52 — Public Channels Discovery `PENDING`
#### SPEC
- **Backend:** Add `isPublic` (boolean) to Conversation schema. Create `GET /api/conversations/public` to list public channels, and `POST /api/conversations/{id}/join` to join them.
- **Frontend:** Add an "Explore" tab to discover public channels. Users can click and join.
- **Test:** Create a public channel, another user searches and joins it successfully.

### TASK 53 — Pin & Forward Messages `PENDING`
#### SPEC
- **Backend:** Add `pinnedMessages` array to Conversation schema. Endpoints: `POST /messages/{id}/pin`, `POST /messages/{id}/forward`.
- **Frontend:** Long-press -> Pin. Render a pinned message bar at the top of the ChatScreen. Long-press -> Forward -> show conversation picker.
- **Test:** Pin a message -> shows at the top for everyone.

### TASK 54 — Rich Text / Markdown Rendering `PENDING`
#### SPEC
- **Frontend:** Replace standard `Text` widget in `MessageBubble` with `flutter_markdown` or similar to support bold, italic, code blocks, and lists.
- **Test:** Send `**Bold** and *Italic*` -> renders correctly.

---

## 🔴 SPRINT 15 — Infrastructure & Reliability — PENDING

### TASK 55 — Offline Message Catch-up `PENDING`
#### SPEC
- **Frontend/Backend:** When STOMP reconnects, fetch all messages missed during the offline period (using the timestamp of the last cached message). Sync the local state.
- **Test:** Go offline -> receive messages -> go online -> messages sync automatically without refreshing the whole page.

### TASK 56 — Rate Limiting (Throttle) `PENDING`
#### SPEC
- **Backend:** Implement Bucket4j or Redis-based rate limiting to prevent spamming endpoints (e.g., max 10 messages / 5 seconds per user). Return HTTP 429 Too Many Requests if exceeded.
- **Test:** Spam send button -> server blocks and returns 429.

---

## 🧪 QA LOG
- [2026-06-01] **TASK 45 — Edit Message → ✅ DONE (full vertical slice).**
  Token budget was tight, so only TASK 45 was cherry-picked (per shutdown instructions);
  TASKS 46–48 remain PENDING.
  - **BE (chat-service):**
    - `Message` model: added `editedAt` (Instant).
    - `MessageResponse` DTO: added `editedAt` field (+ kept backward-compat ctor).
    - `MessageService.editMessage(userId, messageId, newContent)`: sender-only guard,
      rejects editing recalled messages, rejects blank content, stamps `editedAt`.
    - `MessageController`: new `PUT /api/messages/{id}` (body `EditMessageRequest{content}`),
      broadcasts STOMP `MESSAGE_UPDATED` (messageId, content, editedAt) to the conversation topic.
  - **FE (Flutter client):**
    - `MessageModel`: added `editedAt` + `isEdited` getter; parsed in `fromJson`, threaded through `copyWith`.
    - `chat_repository.editMessage()` → PUT call.
    - `stomp_service`: new `editedMessages` stream + `MESSAGE_UPDATED` case → `MessageUpdateEvent`.
    - `ChatNotifier`: `_onEdit` realtime handler, optimistic `editMessage()`, `startEditing/cancelEditing`;
      `ChatState.editingMessage` (mutually exclusive with reply).
    - `MessageBubble`: long-press → "Edit" action (own text messages, not media/recalled);
      shows `(edited)` tag next to the timestamp.
    - `ChatScreen`: `_EditComposerBar` pre-fills composer via `ref.listen`; send button commits the edit.
    - i18n: `actionEdit` + `messageEdited` added to all 7 ARB files; `flutter gen-l10n` regenerated.
  - **Tests:**
    - `mvn test` → **BUILD SUCCESS, 40/40** (MessageServiceTest 16, incl. 4 new edit tests:
      sender-edits-ok, non-sender-throws, recalled-throws, blank-throws).
    - `flutter analyze` → **No issues found**; `flutter test` → **All tests passed**.
  - **Files for Gemini QC:** `model/Message.java`, `dto/MessageResponse.java`, `dto/EditMessageRequest.java`,
    `service/MessageService.java`, `controller/MessageController.java`, `service/MessageServiceTest.java`,
    `chat_state.dart`, `chat_repository.dart`, `stomp_service.dart`, `chat_provider.dart`,
    `ui/widgets/message_bubble.dart`, `ui/chat_screen.dart`, `l10n/app_*.arb`.
- [PENDING] TASKS 46–48 not started — pick up next session.
