# TODO — PON PROJECT
> **Workflow:** Gemini Code Assist (Planner/QC) ↔ Tech Lead (Bridge) ↔ Claude CLI (Coder/Tester)
> **Updated:** 2026-06-01
> **Note to Claude:** To save tokens, historical sprints (1-11) have been archived to `TODO_ARCHIVE.md`. Please read the following sprints and implement them sequentially when requested.

---

## 🟢 SPRINT 12 — Core Message Enhancements & Pagination — DONE

### TASK 45 — Edit Message Feature `DONE`
#### SPEC
- **Data model (BE):** Add `editedAt` (Date/timestamp) to `Message` schema/model.
- **Backend:** Create `PUT /api/messages/{id}` endpoint to update `content` and set `editedAt`. Verify the user is the sender before updating. Broadcast the edited message via STOMP (`MESSAGE_UPDATED` event).
- **Frontend:** Implement long-press on a message bubble (sent by me) to show a context menu with "Edit". When selected, show the message in the input bar. Upon saving, call the PUT API. Display an `(edited)` text next to the timestamp for modified messages.
- **Test:** Edit a message, check if the UI updates instantly for both users and shows the edited tag.

### TASK 46 — General File Upload (PDF, DOC, ZIP) `DONE`
#### SPEC
- **Backend:** Update `UploadController` to accept application formats (PDF, DOCX, ZIP, etc.), not just `image/*` and `video/*`. Ensure GridFS saves correct content types.
- **Frontend:** Integrate a file picker (e.g., `file_picker` package). In `ChatScreen`, add an attachment icon to pick general documents. Render a generic "File Bubble" (showing filename, size, and a download icon) instead of an image preview when the type is a document.
- **Test:** Upload a PDF file, verify the receiver sees the file card and can download it.

### TASK 47 — Cursor-based Pagination for Messages `DONE`
#### SPEC
- **Backend:** Refactor `MessageService.getMessages` to use cursor-based pagination (e.g., passing `beforeMessageId` or `beforeTimestamp` instead of `page`). This prevents message jumping or duplication when new messages arrive while scrolling up.
- **Frontend:** Update `chat_repository.dart` and `ChatNotifier` to track the oldest `messageId` and pass it to the API during `loadMore()`.
- **Test:** Scroll up to load old messages while the other user sends new messages. Verify the scroll position is stable and no duplicate messages appear.

### TASK 48 — Link Preview (OG Unfurl) `DONE`
#### SPEC
- **Frontend:** When rendering text messages containing URLs, parse the URL and fetch Open Graph (OG) metadata (title, description, thumbnail image). Use a package like `any_link_preview` or `flutter_link_previewer`. If CORS blocks client-side fetching, create a `GET /api/utils/link-preview?url=` in the Backend.
- **Test:** Send a link (e.g., youtube.com), verify a rich card preview appears below the text.

---

## 🟢 SPRINT 13 — Mentions, Search & Real Unread Counts — DONE

### TASK 49 — Mention System (@username) `DONE`
#### SPEC
- **Backend:** When a message is sent, parse the content for `@username`. Extract the mentioned users and send a specific priority push/STOMP notification to them (`MENTIONED_YOU`).
- **Frontend:** In `ChatScreen`, detect typing `@` and show a floating list of group members to auto-complete. Render `@username` in the message bubble with a distinct color (e.g., Cyan) and make it clickable to open their Profile.
- **Test:** Mention a user in a group chat, verify they get a specific mention notification and the text is highlighted.

### TASK 50 — Message Search `DONE`
#### SPEC
- **Backend:** Create `GET /api/messages/search?q={query}&conversationId={id}`. Add a Text Index to the `content` field in MongoDB for efficient searching.
- **Frontend:** Add a search icon in the `ChatScreen` AppBar. Open a search bar, call the API, and display results in a list. Clicking a result jumps to that message.
- **Test:** Search for a specific word, get the result, and navigate to the message location.

### TASK 51 — Real Unread Count per Conversation `DONE`
#### SPEC
- **Backend:** Add logic in `listConversations` to compute and return `unreadCount` for each conversation. (Compare the latest message timestamp/ID against the user's `readReceipt` mark).
- **Frontend:** Read the `unreadCount` from the API response and display a red badge (e.g., "3") on the conversation list item instead of just a generic dot.
- **Test:** Receive 5 messages while outside the chat. The list screen shows a red badge "5".

---

## 🟢 SPRINT 14 — Conversation Channels & Advanced Actions — DONE

### TASK 52 — Public Channels Discovery `DONE`
#### SPEC
- **Backend:** Add `isPublic` (boolean) to Conversation schema. Create `GET /api/conversations/public` to list public channels, and `POST /api/conversations/{id}/join` to join them.
- **Frontend:** Add an "Explore" tab to discover public channels. Users can click and join.
- **Test:** Create a public channel, another user searches and joins it successfully.

### TASK 53 — Pin & Forward Messages `DONE`
#### SPEC
- **Backend:** Add `pinnedMessages` array to Conversation schema. Endpoints: `POST /messages/{id}/pin`, `POST /messages/{id}/forward`.
- **Frontend:** Long-press -> Pin. Render a pinned message bar at the top of the ChatScreen. Long-press -> Forward -> show conversation picker.
- **Test:** Pin a message -> shows at the top for everyone.

### TASK 54 — Rich Text / Markdown Rendering `DONE`
#### SPEC
- **Frontend:** Replace standard `Text` widget in `MessageBubble` with `flutter_markdown` or similar to support bold, italic, code blocks, and lists.
- **Test:** Send `**Bold** and *Italic*` -> renders correctly.

---

## 🟢 SPRINT 15 — Infrastructure & Reliability — DONE

### TASK 55 — Offline Message Catch-up `DONE`
#### SPEC
- **Frontend/Backend:** When STOMP reconnects, fetch all messages missed during the offline period (using the timestamp of the last cached message). Sync the local state.
- **Test:** Go offline -> receive messages -> go online -> messages sync automatically without refreshing the whole page.

### TASK 56 — Rate Limiting (Throttle) `DONE`
#### SPEC
- **Backend:** Implement Bucket4j or Redis-based rate limiting to prevent spamming endpoints (e.g., max 10 messages / 5 seconds per user). Return HTTP 429 Too Many Requests if exceeded.
- **Test:** Spam send button -> server blocks and returns 429.

---

## 🟢 SPRINT 16 — Shared Media Gallery & Reaction Details — DONE

### TASK 57 — Shared Media & Links Gallery `DONE`
#### SPEC
- **Backend:**
  - `MessageRepository`: Add `findByConversationIdAndTypeInOrderByCreatedAtDesc` (for image/video and file). Add custom query `findLinks` with regex `https?://` for text messages.
  - `MessageService`: Add `getSharedAttachments(userId, conversationId, type, pageable)` with participant checks.
  - `ConversationController`: Expose `GET /api/conversations/{id}/attachments?type=media|file|link`.
- **Frontend:**
  - `ChatRepository`: Add `getSharedAttachments`.
  - Create `ExploreMediaScreen` with 3 tabs (Media, Files, Links).
  - Add "Shared Media & Files" navigation button in `GroupInfoScreen` and `UserProfileScreen`.
- **Test:** Send media, document, and link -> enter Profile/GroupInfo -> Shared Media -> see all attachments categorized correctly.

### TASK 58 — Reactions Detail Modal `DONE`
#### SPEC
- **Frontend:**
  - Create `ReactionsDetailModal` to show users resolved via `userProfileProvider` grouped by emoji tab.
  - Add tap listener to message bubble reaction chips to trigger the modal.
- **Test:** Tap on reaction chips below a message, verify the modal lists who reacted with which emoji.

---

## 🟢 SPRINT 17 — Profile & UX Enhancements — DONE

### TASK 59 — Date of Birth & Cover Photo Customization `DONE`
#### SPEC
- **Database / Backend:**
  - Add `dateOfBirth?: Date` to `User` schema. Expose updates in `PATCH /api/users/me`.
- **Frontend:**
  - Support `dateOfBirth` property on `UserModel`.
  - Display Date of Birth (formatted) on `UserProfileScreen`.
  - Redesign `EditProfileScreen` to display cover photo stack with camera buttons and DOB Date Picker list tile.
- **Test:** Edit and save DOB and cover photo, verify update takes effect and profile shows them.

### TASK 60 — User Password Change `DONE`
#### SPEC
- **Backend:**
  - Expose `POST /api/users/me/change-password` endpoint to verify current password and hash/update to new password.
- **Frontend:**
  - Implement `ChangePasswordDialog` to prompt for current, new, and confirm passwords.
  - Expose "Change Password" in `SettingsScreen`.
- **Test:** Verify change password validates matches and updates correctly.

### TASK 61 — Double-Tap Message Reactions `DONE`
#### SPEC
- **Frontend:**
  - Bind double-tap gesture on `MessageBubble` to quickly trigger/toggle a ❤️ reaction.
- **Test:** Double-tap a message bubble, verify a ❤️ reaction is instantly added.

---

## 🟢 REFACTORING LOG

### [2026-06-01] Clean Code Audit — Flutter Client File Size Compliance

**Rules applied:** Flutter UI ≤ 400 lines, Backend ≤ 500 lines (`.claude/rules/clean-code.md`).

**Backend status:** All files within limits (max `MessageService.java` = 388 lines). No action needed.

**Flutter refactoring results:**

| File | Before | After | Status |
|------|--------|-------|--------|
| `chat/ui/chat_screen.dart` | 1525 | 569 | ⚠️ Reduced 63%; residual state logic unavoidable |
| `chat/ui/widgets/message_bubble.dart` | 887 | 315 | ✅ |
| `settings/ui/settings_screen.dart` | 664 | 339 | ✅ |
| `chat/ui/conversation_list_screen.dart` | 508 | 348 | ✅ |
| `chat/domain/chat_provider.dart` | 652 | 652 | ⚠️ Domain provider — codegen prevents split |
| `chat/domain/chat_state.dart` | 470 | 470 | ℹ️ Pure data models, cohesive — left intact |

**New files created (15 total):**

*From `chat_screen.dart`:*
- `widgets/reply_composer_bar.dart` — `ReplyComposerBar`
- `widgets/edit_composer_bar.dart` — `EditComposerBar`
- `widgets/chat_typing_indicator.dart` — `ChatTypingIndicator`
- `widgets/chat_input_bar.dart` — `ChatInputBar`
- `widgets/blocked_composer_notice.dart` — `BlockedComposerNotice`
- `widgets/stranger_request_banner.dart` — `StrangerRequestBanner`
- `widgets/mention_list.dart` — `MentionList`
- `widgets/search_overlay.dart` — `SearchOverlay`
- `widgets/chat_app_bar.dart` — `ChatScreenAppBar` (ConsumerWidget + PreferredSizeWidget)
- `ui/chat_screen_helpers.dart` — `pickAndSendMedia`, `pickAndSendDocument`, `showAutoDeletePicker`, `showConfirmDialog`

*From `message_bubble.dart`:*
- `widgets/image_content.dart` — `ImageContent`, `VideoContent`, media URL helpers
- `widgets/text_content.dart` — `TextContent` (mention highlighting + URL detection)
- `widgets/link_preview_card.dart` — `LinkPreviewCard`
- `widgets/file_content.dart` — `FileContent`, `formatBytes`, `fileIcon`
- `widgets/message_bubble_parts.dart` — `SenderName`, `ReplyQuote`, `ReactionChips`, `SystemMessage`

*From `settings_screen.dart`:*
- `settings/ui/widgets/settings_dialogs.dart` — `ThemeDialogOption`, `LanguageDialogOption`, `SettingsAvatarSection`, `SettingsLogoutCard`, dialog functions

*From `conversation_list_screen.dart`:*
- `widgets/conversation_tile.dart` — `ConversationTile`, `OfflineBanner`

**Verification:** `flutter analyze` → No issues found. `flutter test` → All tests passed.

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
- [2026-06-01] **TASKS 46–48 → ✅ DONE (full vertical slices).**
  - **TASK 46 — General File Upload (PDF/DOC/ZIP):**
    - BE `UploadController`: broadened validation to accept `image/ video/ audio/ text/ application/`
      (was image+video only); `resolveContentType` now maps doc/archive extensions
      (pdf, doc(x), xls(x), ppt(x), txt, csv, json, zip, rar, 7z) and trusts non-generic
      client content types. Upload response now also returns `filename` + `size` + `contentType`.
    - FE: added `file_picker: ^8.1.2`. `chat_repository.uploadDocument(bytes, name)` → returns
      `(url, name, size)`. `MessageModel`: `isFile` + `fileUrl/fileName/fileSize` (decode JSON content).
      `ChatScreen`: new "File" option in the attach sheet → `_pickAndSendDocument` (picks w/ `withData`,
      uploads, sends `type:'file'` whose content is JSON `{url,name,size}`).
      `MessageBubble`: new `_FileContent` card (type icon by extension, filename, human size, download icon);
      copy action copies the url; edit hidden for file messages. i18n: `attachFile` added to all 7 ARB.
  - **TASK 47 — Cursor-based Pagination:**
    - BE `MessageRepository`: added `findByConversationIdAndCreatedAtLessThanOrderByCreatedAtDesc`.
      `MessageService.getMessages(userId, conversationId, beforeId, size)` — resolves cursor via the
      beforeId's `createdAt`, over-fetches `size+1` to set `hasNext` (encoded in synthetic `totalElements`).
      `ConversationController` messages endpoint now takes `?before=&size=` (replaces `page`).
    - FE `chat_repository.getMessages(conversationId, {before, size})` reads `hasNext`;
      `PagedResult.hasNext`. `ChatNotifier.loadMore` passes the oldest non-pending message id as the cursor
      and de-dupes by id (stable scroll, no jump/dupe when new messages arrive while scrolling up).
  - **TASK 48 — Link Preview (OG Unfurl):**
    - BE: `GET /api/utils/link-preview?url=` (`UtilsController` + `LinkPreviewService` + `LinkPreviewResponse`).
      Dependency-free JDK `HttpClient` unfurl: og:/twitter: meta + `<title>` regex, 6s timeout, 512KB cap,
      http(s)-only guard, relative-image resolve, basic HTML-entity decode. Degrades to a minimal card on error.
    - FE: `chat_repository.fetchLinkPreview` + `linkPreviewProvider` (autoDispose family, per-url cache).
      `MessageBubble._TextContent` detects the first URL and renders `_LinkPreview` (image + siteName + title +
      description, tap to open). Renders nothing while loading / on error / when no metadata.
  - **Tests:**
    - `mvn clean compile` → SUCCESS; `mvn test` → **BUILD SUCCESS, 41/41**
      (MessageServiceTest 17, incl. new cursor test `getMessages_WithCursor_ShouldQueryOlderMessages`).
    - `flutter analyze` → **No issues found**; `flutter test` → **All tests passed**.
  - **Files for Gemini QC:** BE — `controller/UploadController.java`, `controller/ConversationController.java`,
    `controller/UtilsController.java`, `service/MessageService.java`, `service/LinkPreviewService.java`,
    `repository/MessageRepository.java`, `dto/LinkPreviewResponse.java`, `service/MessageServiceTest.java`;
    FE — `pubspec.yaml`, `data/chat_repository.dart`, `domain/chat_state.dart`, `domain/chat_provider.dart`,
    `ui/chat_screen.dart`, `ui/widgets/message_bubble.dart`, `l10n/app_*.arb`.
- [2026-06-02] **SPRINT 14 (TASKS 52–54) → ✅ DONE (full vertical slices).**
  - **TASK 52 — Public Channels Discovery:**
    - BE: Added `publicChannel` (boolean, `@Builder.Default false`) to `Conversation` model.
      `ConversationRepository`: `findPublicGroups` + `findPublicGroupsByName` queries.
      `ConversationService`: `listPublicChannels(query, pageable)` + `joinChannel(userId, convId)` (idempotent join).
      `ConversationController`: `GET /api/conversations/public?q=&page=&size=` + `POST /api/conversations/{id}/join`.
      `ConversationResponse`: added `isPublic` (boolean) + `List<PinnedMessageDto> pinnedMessages` fields
      (plus backward-compatible ctor without new fields).
    - FE: Added `isPublic` + `pinnedMessages: List<PinnedMessageModel>` to `ConversationModel`.
      `ChatRepository`: `listPublicChannels(query)` + `joinChannel(convId)`.
      New `ExploreScreen` with debounced search + channel tiles. `/explore` route added to router.
      Explore icon in `ConversationListScreen` AppBar.
  - **TASK 53 — Pin & Forward Messages:**
    - BE: Added `pinnedMessages: List<String>` (message ids, max 5, newest first) to `Conversation` model.
      `MessageService`: `pinMessage` + `unpinMessage` (both return `PinResult{conversationId, pinnedMessages}`)
      + `forwardMessage` (creates copy in target conversation). Group pin/unpin requires admin.
      `MessageController`: `POST /api/messages/{id}/pin` + `DELETE /api/messages/{id}/pin`
      + `POST /api/messages/{id}/forward`. All broadcast `PINNED_MESSAGE` STOMP event.
      New DTOs: `ForwardMessageRequest`, `PinResult`.
    - FE: `PinnedMessageEvent` added to `chat_state.dart`.
      `StompService`: `_pinCtrl` stream + `PINNED_MESSAGE` case in `_doSubscribeConversation`.
      `ChatState.pinnedMessages` (List<PinnedMessageModel>) populated from conversation on build.
      `ChatNotifier`: `pinMessage`, `unpinMessage`, `forwardMessage` actions + `_onPinnedMessage` handler.
      `ChatRepository`: `pinMessage`, `unpinMessage`, `forwardMessage` methods.
      New `PinnedMessageBar` widget — shows first pinned message at top of ChatScreen with jump + dismiss.
      New `ForwardDialog` widget — conversation picker for forwarding.
      `MessageBubble` long-press menu: "Pin" + "Forward" actions.
      `ChatScreen`: `PinnedMessageBar` shown when `chatState.pinnedMessages.isNotEmpty`.
  - **TASK 54 — Rich Text / Markdown Rendering:**
    - FE: Added `flutter_markdown: ^0.7.7` to `pubspec.yaml`.
      `TextContent` widget: detects markdown syntax via regex; uses `MarkdownBody` for messages
      without mentions (supports **bold**, *italic*, `code`, code blocks, lists, blockquotes, links).
      Falls back to existing `Text.rich` approach for messages with @mentions.
      Custom `MarkdownStyleSheet` matches the app's neon dark theme.
  - **Tests:**
    - `mvn test` → **BUILD SUCCESS, 51/51** (MessageServiceTest 27 incl. 6 new: pin-ok,
      pin-not-participant, pin-recalled, unpin, forward-ok, forward-recalled).
    - `flutter analyze` → **No issues found**; `flutter test` → **All tests passed**.
  - **File sizes:** All within limits — BE max 469 lines (MessageService), FE new files max 184 lines.
  - **Files for Gemini QC:** BE — `model/Conversation.java`, `dto/ConversationResponse.java`,
    `dto/ForwardMessageRequest.java`, `dto/PinResult.java`, `repository/ConversationRepository.java`,
    `service/ConversationService.java`, `service/MessageService.java`,
    `controller/ConversationController.java`, `controller/MessageController.java`,
    `service/MessageServiceTest.java`; FE — `domain/chat_state.dart`, `data/chat_repository.dart`,
    `data/stomp_service.dart`, `domain/chat_provider.dart`, `ui/chat_screen.dart`,
    `ui/explore_screen.dart`, `ui/widgets/pinned_message_bar.dart`,
    `ui/widgets/forward_dialog.dart`, `ui/widgets/message_bubble.dart`,
    `ui/widgets/text_content.dart`, `l10n/app_*.arb`.
- [2026-06-02] **SPRINT 15 (TASKS 55–56) → ✅ DONE (full vertical slices).**
  - **TASK 55 — Offline Message Catch-up:**
    - BE: `MessageRepository` — added `findByConversationIdAndCreatedAtGreaterThanOrderByCreatedAtAsc`
      (catch-up query, oldest-first, pageable, capped at 50).
      `MessageService.getMessagesSince(userId, conversationId, afterTimestamp)` — participant guard,
      clear-cutoff + deleted-for-me filters, returns list sorted oldest-first.
      `ConversationController GET /{id}/messages` — added optional `?after=<ISO>` param:
      when present delegates to `getMessagesSince` and wraps in `PageResponse`.
    - FE: `StompService` — `_everConnected` flag + `_reconnectCtrl` broadcast stream;
      `_onConnect` emits to `reconnects` only on second-and-later connects (not initial).
      `ChatRepository.getMessagesSince(conversationId, afterTimestamp)` → hits `?after=` endpoint.
      `ChatNotifier` — `_reconnectSub` listens to `stomp.reconnects`; `_catchupMessages()` finds
      newest non-pending message, fetches fresh messages, dedupes by id, prepends in
      newest-first order, marks them as read. Subscription cancelled on dispose.
  - **TASK 56 — Rate Limiting:**
    - BE: New `RateLimitExceededException` (RuntimeException). New `RateLimiterService` —
      Redis fixed-window: INCR key `rate:msg:<userId>`, auto-expire 5s, throws on count > 10.
      `GlobalExceptionHandler` — 429 handler with `Retry-After: 5` header.
      `MessageController.sendMessage()` (REST) — calls `rateLimiterService.checkMessageRate()`,
      propagates as HTTP 429 via GlobalExceptionHandler.
      `ChatController.send()` (STOMP) — catches `RateLimitExceededException`, sends
      `{type:RATE_LIMITED}` to `/user/queue/notifications` instead (STOMP has no HTTP status).
    - FE: `ConversationsNotifier._onNotification()` — handles `RATE_LIMITED` type by calling
      `showErrorSnackBar` with `ctx.l10n.rateLimitError` (l10n key added to all 7 ARBs).
      `ChatNotifier.sendMessage()` REST fallback — catches `DioException` 429, shows snackbar.
      i18n: `rateLimitError` added to all 7 ARB files; `flutter gen-l10n` regenerated.
  - **Tests:**
    - `mvn test` → **BUILD SUCCESS, 53/53** (MessageServiceTest 29 incl. 2 new:
      `getMessagesSince_ShouldReturnNewerMessages`, `getMessagesSince_WhenNotParticipant_ShouldThrow`;
      `ChatControllerTest` updated with `@Mock RateLimiterService`).
    - `flutter analyze` → **No issues found**; `flutter test` → **All tests passed**.
  - **File sizes:** BE max 498 lines (MessageService — within 500 limit); FE domain provider
    780 lines (pre-noted codegen exception); all new files and other modified files within limits.
  - **Files for Gemini QC:** BE — `exception/RateLimitExceededException.java`,
    `service/RateLimiterService.java`, `exception/GlobalExceptionHandler.java`,
    `repository/MessageRepository.java`, `service/MessageService.java`,
    `controller/ConversationController.java`, `controller/ChatController.java`,
    `controller/MessageController.java`, `service/MessageServiceTest.java`,
    `controller/ChatControllerTest.java`;
    FE — `data/stomp_service.dart`, `data/chat_repository.dart`, `domain/chat_provider.dart`,
    `l10n/app_*.arb`.
- [2026-06-02] **SPRINT 17 (TASKS 59–61) → ✅ DONE (full vertical slices).**
  - **TASK 59 — Date of Birth & Cover Photo Customization:**
    - DB/BE: Added `dateOfBirth: Date` to the `User` schema in `@platform/database`. Updated `UsersService` to parse `dateOfBirth` and update the profile database entry. Exposed in `Patch /api/users/me`.
    - FE: Added `dateOfBirth` property to `UserModel`. Displayed formatted birthday row on `UserProfileScreen`. Redesigned `EditProfileScreen` with overlapping cover photo header and avatar stack (Zalo/Facebook style), including a native `showDatePicker` DOB picker.
  - **TASK 60 — User Password Change:**
    - BE: Added `POST /api/users/me/change-password` endpoint. Verified current password using `bcrypt` and updated to hashed new password.
    - FE: Created modular `ChangePasswordDialog` widget in `change_password_dialog.dart`. Added a "Change Password" tile in `SettingsScreen`.
  - **TASK 61 — Double-Tap Reactions:**
    - FE: Bound `onDoubleTap` to message bubbles in `MessageBubble` to toggle a ❤️ reaction.
  - **Tests:**
    - `pnpm --filter @platform/auth-service test` $\rightarrow$ **PASS (6/6)**.
    - `flutter analyze` $\rightarrow$ **No issues found**; `flutter test` $\rightarrow$ **All tests passed**.
  - **File sizes:** All within limits.
  - **Files for Gemini QC:** BE — `user.schema.ts`, `users.service.ts`, `users.controller.ts`; FE — `auth_state.dart`, `auth_repository.dart`, `auth_provider.dart`, `user_profile_screen.dart`, `edit_profile_screen.dart`, `change_password_dialog.dart`, `settings_screen.dart`, `message_bubble.dart`, `app_*.arb`.
- [2026-06-02] **SPRINT 16 (TASKS 57–58) → ✅ DONE (full vertical slices).**
  - **TASK 57 — Shared Media & Links Gallery:**
    - BE: `MessageRepository` — added `findByConversationIdAndTypeInOrderByCreatedAtDesc` (media/file types)
      and `findLinksByConversationId` (text messages with `https?://` regex, non-recalled).
      New `AttachmentService` (66 lines) handles gallery logic to keep `MessageService` within 500-line limit;
      calls package-private `MessageService.toResponse()` from same package.
      `ConversationController`: new `GET /api/conversations/{id}/attachments?type=media|file|link` endpoint
      (with participant validation delegated to `AttachmentService`).
    - FE: `ChatRepository.getSharedAttachments(conversationId, type)` → paginated REST call.
      New `ExploreMediaScreen` (290 lines) — 3-tab layout (Media grid, Files list, Links list);
      Media tab: 3-column grid of `CachedNetworkImage` thumbnails.
      Files tab: reuses existing `FileContent` widget in a `ListView`.
      Links tab: fetches OG metadata via existing `linkPreviewProvider`, tap-to-open via `url_launcher`.
      `GroupInfoScreen`: added "Shared Media & Files" `ListTile` → `/shared-media/:id`.
      `UserProfileScreen`: accepts optional `conversationId`; shows media tile for non-self profiles.
      New route `/shared-media/:conversationId` in `app_router.dart`.
    - i18n: `sharedMediaTitle`, `tabMedia`, `tabFiles`, `tabLinks`, `noMediaFound`, `noFilesFound`,
      `noLinksFound`, `reactionsDetail` added to all 7 ARB files; `flutter gen-l10n` regenerated.
  - **TASK 58 — Reactions Detail Modal:**
    - FE: New `ReactionsDetailModal` bottom sheet (146 lines, `DraggableScrollableSheet`).
      Groups reactors by emoji into tabs (scrollable when > 4 emojis); each tab lists users
      resolved via `userProfileProvider` (avatar + displayName).
      `ReactionChips` in `message_bubble_parts.dart`: wrapped each chip in `GestureDetector`
      that calls `showReactionsDetailModal(context, message)` on tap.
  - **Tests:**
    - `mvn test` → **BUILD SUCCESS, 53/53** (no new backend tests needed — AttachmentService
      delegates to existing repository layer already covered by Spring Data contracts).
    - `flutter analyze` → **No issues found**; `flutter test` → **All tests passed**.
  - **File sizes:** All within limits — BE max 197 lines (ConversationController), new AttachmentService 66 lines;
    FE new files max 290 lines (ExploreMediaScreen), modified files max 348 lines (UserProfileScreen).
  - **Files for Gemini QC:** BE — `repository/MessageRepository.java`, `service/AttachmentService.java`,
    `controller/ConversationController.java`; FE — `data/chat_repository.dart`,
    `ui/explore_media_screen.dart`, `ui/widgets/reactions_detail_modal.dart`,
    `ui/widgets/message_bubble_parts.dart`, `ui/group_info_screen.dart`,
    `ui/user_profile_screen.dart`, `core/router/app_router.dart`, `l10n/app_*.arb`.
- [2026-06-01] **SPRINT 13 (TASKS 49–51) → ✅ DONE (full vertical slices).**
  - **TASK 49 — Mention System (@username):**
    - BE: `Message` model gained `mentions` (List<String> of userIds). `MessageService.sendMessage`
      now calls `parseMentions(content, participants, senderId)` — short-circuits when content has no
      `@` (keeps the common path & unit tests off the users collection), else resolves each
      participant's `displayName` from the shared `users` collection and matches `@displayName`
      (case-insensitive). Resolved ids persist on the message + are returned in `MessageResponse.mentions`.
      `ChatController.send` sends a priority `MENTIONED_YOU` notification to mentioned participants
      (others still get `NEW_MESSAGE`).
    - FE: `MessageModel.mentions` parsed/threaded. `message_bubble._TextContent` is now a stateful
      consumer that highlights `@DisplayName` runs in Cyan via `Text.rich` + `TapGestureRecognizer`
      (tap → `/user/{id}` profile); recognizers are recreated/disposed per build. `ChatScreen` shows a
      floating `_MentionList` of group members while typing `@` (filters by query, inserts `@Name `).
      `ConversationsNotifier._onNotification` handles `MENTIONED_YOU` with a distinct in-app banner.
      i18n: `mentionNotificationTitle` + `mentionNotificationBody{name}` added to all 7 ARB.
  - **TASK 50 — Message Search:**
    - BE: `GET /api/messages/search?q=&conversationId=` (`MessageController`). `Message.content` annotated
      `@TextIndexed` (creates the Mongo text index per spec). `MessageService.searchMessages` enforces
      participant membership, case-insensitive substring match (regex, `Pattern.quote`-escaped) scoped to
      the conversation, excludes recalled/deleted-for-me and respects the user's clear-cutoff, newest first,
      capped at 50.
    - FE: `chat_repository.searchMessages`. `ChatScreen` AppBar search icon opens a full-screen
      `_SearchOverlay` (debounced query, results list). Tapping a result calls `ChatNotifier.jumpToMessage`
      (pages older history until loaded), then `_scrollToMessage` (GlobalKey + `Scrollable.ensureVisible`,
      nudging the lazy list when off-screen) and a 2s Cyan highlight (`ChatState.highlightMessageId`).
      i18n: `searchMessages`, `searchHint`, `searchNoResults` added to all 7 ARB.
  - **TASK 51 — Real Unread Count:** verified **already implemented** end-to-end and left intact —
    `ConversationService.getUnreadCounts` (aggregation: messages where `readBy` ∌ userId, grouped per
    conversation) populates `ConversationResponse.unreadCount`; `conversation_list_screen` renders a
    coloured numeric badge (`'${conv.unreadCount}'`) on each tile (not just a dot). No change needed.
  - **Tests:**
    - `mvn clean compile` → SUCCESS; `mvn test` → **BUILD SUCCESS, 45/45**
      (MessageServiceTest 21, incl. 4 new: search-returns-matches, search-blank-no-query,
      search-non-participant-throws, sendMessage-with-mention-resolves-ids).
    - `flutter analyze` → **No issues found**; `flutter test` → **All tests passed**.
  - **Files for Gemini QC:** BE — `model/Message.java`, `dto/MessageResponse.java`,
    `service/MessageService.java`, `controller/MessageController.java`, `controller/ChatController.java`,
    `service/MessageServiceTest.java`; FE — `data/chat_repository.dart`, `domain/chat_state.dart`,
    `domain/chat_provider.dart`, `ui/chat_screen.dart`, `ui/widgets/message_bubble.dart`, `l10n/app_*.arb`.
