# SPRINT W-15 — Chat UI/UX Refinement & Parity — Implementation Plan

> **Scope:** Web (Next.js, `apps/web/`) only. Flutter mobile is the **source of truth** — every
> behaviour below already exists in `apps/client/` and the web must mirror it (`.claude/rules/sync.md`).
> **Backend:** No chat-service / auth-service / ai-service changes required for **any** task.
> Quick-reaction, nicknames, and wallpaper are all **client-side localStorage + `system.*` broadcast**
> patterns in Flutter (no backend field). Web mirrors them identically.

---

## Key cross-platform conventions (confirmed by reading Flutter source)

| Concern | Storage key (web) | Sync message | Flutter origin |
|---------|-------------------|--------------|----------------|
| Wallpaper | `wallpaper-<convId>` (localStorage) | `system.theme.changed:<value>` | `chat_wallpaper_dialog.dart`, `chat_provider.dart` |
| Nickname | `chat_nicknames_<convId>` (localStorage, JSON map) | `system.nickname.changed:<userId>:<nickname>` | `conversation_customisation_dialogs.dart`, `chat_provider.dart` |
| Quick reaction | `chat_quick_reaction_<convId>` (localStorage, **MISSING on web**) | `system.quick_reaction.changed:<emoji>` | `QuickReactionNotifier` (`chat_provider.dart:1135`), `conversation_customisation_dialogs.dart` |

System-message format is shared by both platforms; web already humanises 3 of them
(`MessageBubble.tsx` lines 109-126). The sync message is sent via
`chatService.sendMessage(convId, content, 'system')`.

---

## Task W-15.1: Chat List Sidebar Preview Logic & System Messages Formatting

### Summary
Two sub-features in the sidebar list and chat area:
1. **Preview prefix:** 1-on-1 last-message subtitle shows `"You: <msg>"` when the current user sent
   the last message, else `"<msg>"`.
2. **System-message formatting:** Map `system.*` codes to clean human-readable text in BOTH the
   sidebar preview AND the main chat area (web already does the chat area for 3 codes; needs the
   group/member codes + attachment label added, and the sidebar needs it entirely).

### Files
| File | Change | Detail |
|------|--------|--------|
| `apps/web/components/chat/ConversationItem.tsx` | 수정 | Replace `conv.lastMessage?.content ?? 'Chưa có tin nhắn'` (line 98) with a `previewText()` helper: (a) if `lastMessage.senderId === currentUser?.id` and `conv.type==='direct'` → prefix `t('youColon')` i.e. `"You: "`; (b) run content through a shared `humanizeSystemMessage()` before display; (c) if content contains `/api/uploads/` → `t('attachmentLabel')` (mirror Flutter `conversation_tile.dart:224`). |
| `apps/web/lib/system-messages.ts` | **신규** | New shared util `humanizeSystemMessage(content, t, opts?)` covering all `system.*` codes (theme/quick_reaction/nickname/group.created/members.added/member.left/member.removed/member.joined) + attachment detection. Single source of truth used by both `ConversationItem` and `MessageBubble`. Mirrors `message_bubble_parts.dart:_systemText` + `conversation_tile.dart:_subtitleText`. |
| `apps/web/components/chat/MessageBubble.tsx` | 수정 | Replace the inline 3-branch system humanise (lines 110-118) with `humanizeSystemMessage(message.content, t)` so the bubble also handles group/member codes (currently shows raw code for those). |
| `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json` | 수정 | Add keys under `chat`: `youColon` ("You: "), `systemGroupCreated`, `systemMembersAdded`, `systemMemberLeft`, `systemMemberRemoved`, `systemMemberJoined`. (`attachmentLabel`, `systemThemeChanged`, `systemQuickReactionChanged`, `systemNicknameChanged` already exist — verify `attachmentLabel` exists, add if missing.) vi = full translation, en = full, others = English stub per existing convention. |

### Notes / Edge cases
- `ConversationItem` reads `currentUser` from `useAuthStore`. `conv.lastMessage` is typed
  `{ content, senderId, ... }` (types.ts:27) so `senderId` is available — no API change.
- Only prefix `"You:"` for `type === 'direct'` (Messenger does not prefix in groups per the task; if
  group prefix is desired later it would use the sender's name, out of scope here).
- AI conversations: last message may be `@AI ...`; leave as-is (the prefix logic still applies if the
  user sent it). Do not special-case.
- Keep `'Chưa có tin nhắn'` empty-state but move it to an i18n key if not already (`noMessagesYet`).

### Done criteria
- Direct chat where I sent the last message shows `"You: hello"`; where they sent it shows `"hello"`.
- A `system.theme.changed:...` last message shows `"Chat theme changed"` in the sidebar, not the raw code.
- Group system codes (`system.group.created` etc.) render human text in both sidebar and chat bubble.
- `tsc --noEmit` clean.

---

## Task W-15.2: Chat Background Upload & Interactive Preview Modal

### Summary
(a) Fix any broken background-image upload path. (b) Convert wallpaper application to a **two-step
preview flow**: uploading a new image opens a live preview modal showing a mock chat interface
(dummy bubbles) over the background with fit/scale adjustment; the wallpaper is persisted only on
**Save/Submit**, not immediately on upload.

### Current state (read)
`WallpaperPickerModal.tsx` already: uploads via `chatService.uploadFile`, shows a small live preview,
has a `cover/contain/fill` fit selector, and applies only on Confirm (persists `wallpaper-<convId>`,
dispatches `wallpaper-changed`, broadcasts `system.theme.changed:`). So the **core flow exists** — the
task is (1) verify/repair upload, (2) upgrade the preview to a realistic mock-chat preview with
scale/position adjustment.

### Files
| File | Change | Detail |
|------|--------|--------|
| `apps/web/components/chat/WallpaperPickerModal.tsx` | 수정 | (1) Enlarge the preview area into a **mock chat panel**: render 3-4 dummy `MessageBubble`-style rows (one incoming, one outgoing) over the chosen background using the same wallpaper-resolution logic as the real chat page, so the user sees exactly how it looks. (2) Add a **scale slider** (object `background-size` percentage) in addition to the existing `cover/contain/fill` fit. Encode as `#fit=<fit>&scale=<n>` — extend `splitFit()` accordingly. (3) Add upload error surfacing via `toast.error(t('wallpaperUploadError'))` (currently silently swallowed in the `catch` at line 70). |
| `apps/web/app/(main)/conversations/[id]/page.tsx` | 수정 | Extend `resolveWallpaper()` (lines 147-164) to parse the new `&scale=` param into `backgroundSize`/`background-position` so the saved coordinates apply exactly. Keep backward-compat with `#fit=` only and bare preset/flat keys. |
| `apps/web/components/chat/GroupSettingsDrawer.tsx` | 수정 | Its inline `WALLPAPER_PRESETS` grid (lines 58-65, 315-337) writes **flat keys** (`'sunset'`, `'midnight'`) directly to `wallpaper-<convId>` — divergent from `WallpaperPickerModal`'s `preset:` format and bypasses the preview/upload + system broadcast. Replace the inline grid with a button that opens `WallpaperPickerModal` (same as `ConversationSettingsDrawer` does) so groups get the same upload+preview flow and consistent storage format. |
| `apps/web/messages/{7 locales}.json` | 수정 | Add `wallpaperUploadError`, `wallpaperScale` keys. |

### Notes / Edge cases
- **Upload bug to verify:** `chatService.uploadFile` returns `{url, filename, size}`; the stored value
  uses `res.url` which may be relative — `absoluteMediaUrl()` is already applied in the preview (line 109)
  and in `resolveWallpaper` (line 157). Confirm the relative URL round-trips; if the image 404s, the
  likely cause is the URL not being prefixed in one of the two render sites. Test with a real upload.
- Reuse `absoluteMediaUrl` from `lib/media.ts` everywhere — never construct media URLs by hand.
- Do not apply on upload — only on Confirm (already correct; keep it).
- Persisted format change must stay parseable by Flutter (it ignores unknown `&scale=`; it reads the URL
  before `#`). Safe.

### Done criteria
- Uploading an image shows a mock-chat preview over that image with adjustable fit + scale.
- Closing/Cancel does NOT change the wallpaper; Save applies it and broadcasts `system.theme.changed:`.
- Group chats use the same modal (no more flat-key divergence).
- Uploaded image renders correctly in the live chat (no 404), at the saved fit/scale.
- `tsc --noEmit` clean.

---

## Task W-15.3: Quick Reaction (Emoji) Customization Bug

### Summary
The "Quick Reaction" entry in `ConversationSettingsDrawer` is a **non-functional stub** — clicking it
shows `toast('Coming soon')` (line 368-371). Implement it to mirror Flutter: an emoji picker that
updates the conversation's quick reaction in localStorage + broadcasts `system.quick_reaction.changed:`,
and the chat composer's quick-reaction button must reflect the chosen emoji.

### Root cause
The task says "cannot be changed in DB" — but Flutter stores this **client-side**
(`shared_preferences chat_quick_reaction_<convId>`, default `'👍'`), NOT in the DB. The web simply
never implemented it. **No backend/DB work** — fix is to add the missing client-side store + picker +
wire the composer button (which currently hard-codes 👍 in `MessageInput.tsx`).

### Files
| File | Change | Detail |
|------|--------|--------|
| `apps/web/lib/quick-reaction.ts` | **신규** | Mirror `lib/nicknames.ts` exactly: `getQuickReaction(convId)` (default `'👍'`), `setQuickReaction(convId, emoji)` (writes `chat_quick_reaction_<convId>`, dispatches `QUICK_REACTION_EVENT`), `quickReactionSystemMessage(emoji)` → `system.quick_reaction.changed:<emoji>`, `applyQuickReactionSystemMessage(convId, content)`, and `useQuickReaction(convId)` reactive hook. |
| `apps/web/components/chat/ConversationSettingsDrawer.tsx` | 수정 | Replace the `Coming soon` button (lines 368-371) with an emoji picker (reuse the curated emoji set / popover pattern from `MessageInput.tsx`'s existing emoji popover, or a small inline grid). On select: `setQuickReaction(conv.id, emoji)` + `chatService.sendMessage(conv.id, quickReactionSystemMessage(emoji), 'system')` + `toast.success`. Show the current emoji next to the label. |
| `apps/web/components/chat/MessageInput.tsx` | 수정 | The quick-reaction send button (👍 when input empty, added in W-11.7) currently hard-codes the emoji. Replace with `useQuickReaction(conversationId)` so it renders + sends the conversation's chosen emoji. (Need to confirm `conversationId` is available — `conversation` prop is passed in; use `conversation.id`.) |
| `apps/web/app/(main)/conversations/[id]/page.tsx` | 수정 | In the STOMP/historical system-message handling (the `applyNicknameSystemMessage` calls at lines 172-178 and 315-318), also call `applyQuickReactionSystemMessage(id, content)` so the picked emoji syncs from other devices/participants. |

### Notes / Edge cases
- Default emoji is `'👍'` (matches Flutter `QuickReactionNotifier` super('👍')).
- The system message `system.quick_reaction.changed:<emoji>` is already humanised in `MessageBubble` (line 115) and will be in the sidebar via W-15.1.
- The emoji is a single char; split on first `:` only (emoji has no `:`).

### Done criteria
- Opening settings → Quick Reaction → picking ❤️ updates the label immediately and the composer's
  quick-reaction button becomes ❤️.
- Reopening the conversation persists ❤️ (localStorage).
- A `system.quick_reaction.changed:❤️` appears in the thread and renders as humanised text.
- `tsc --noEmit` clean.

---

## Task W-15.4: Nickname Configuration (1-on-1 Chats)

### Summary
Messenger-style nickname editing in 1-on-1 chats: allow setting a nickname for **both** participants
(the other user AND yourself), with updates reflected immediately across chat header, message bubbles
(reply preview / sender labels), and sidebar.

### Current state (read)
Nickname infra already exists (`lib/nicknames.ts`: per-user JSON map, `useNickname`, system-message
sync) and `ConversationSettingsDrawer` already has a single nickname input — but it **only edits the
other user** (`otherUserId`, lines 372-391). Gaps vs. Messenger / Flutter
(`conversation_customisation_dialogs.dart` edits both):
1. No way to set **your own** nickname.
2. Header (`ConversationHeader`) uses the nickname for the other user (line 57, 60) — OK, but the
   sidebar (`ConversationItem`) does **not** apply nicknames, and message bubbles
   (`MessageBubble` sender label / reply preview) show `senderName`, not the nickname.

### Files
| File | Change | Detail |
|------|--------|--------|
| `apps/web/components/chat/ConversationSettingsDrawer.tsx` | 수정 | Replace the single nickname input with a **two-row nickname editor** (mirror Flutter): one for the other user, one for the current user. Each: `setNickname(conv.id, targetId, value)` + broadcast `nicknameSystemMessage(targetId, value)`. Both rows visible only for `isDirect`. Pre-fill from `getNickname`. |
| `apps/web/components/chat/ConversationItem.tsx` | 수정 | Apply nickname to the direct-chat display name: `const nick = getNickname(conv.id, otherUserId)` (or `useNickname`) → prefer over `otherUser?.displayName`. Mirrors header behaviour. |
| `apps/web/components/chat/MessageBubble.tsx` | 수정 | Sender label (line 168-176) and reply-preview sender (line 157-159): resolve the sender's nickname via `useNickname(conversationId, message.senderId)` before falling back to `message.senderName`. Need to thread `conversationId` into `MessageBubble` props (currently not passed — add `conversationId` prop and pass from page). |
| `apps/web/app/(main)/conversations/[id]/page.tsx` | 수정 | Pass `conversationId={id}` to `<MessageBubble>`. (System-message seeding already done at lines 172-178 / 315-318.) |
| `apps/web/messages/{7 locales}.json` | 수정 | Add `nicknameYou` ("Your nickname"), `nicknameOther` ("Their nickname") if splitting the labels. |

### Notes / Edge cases
- `useNickname` is reactive (listens to `NICKNAME_EVENT`), so header/sidebar/bubbles update immediately
  on local edit without refetch.
- Empty nickname = clear (the `writeNickname` already deletes the key on empty) → falls back to real name.
- Cross-device sync: incoming `system.nickname.changed:` already parsed in the page; verify both
  participants' nicknames seed correctly (the format supports any targetId, including self).
- `MessageBubble` is used in multiple places — adding a required `conversationId` prop: make it optional
  to avoid breaking any other caller, or update all call sites (search shows only the conversation page
  renders it — safe to make required, but grep first).

### Done criteria
- In a 1-on-1 chat, settings shows two nickname fields (you + them); editing either updates header,
  sidebar item, and message sender/reply labels instantly.
- Nicknames persist across reload and sync to the other participant via the system message.
- `tsc --noEmit` clean.

---

## Task W-15.5: Group Chat Settings UI Parity

### Summary
Restructure the **group** settings sidebar into a Messenger-style menu with collapsible sections
(Chat Info, Customize Chat, Media/Files, Privacy & Support), with every button/toggle fully wired.
Currently groups open `GroupSettingsDrawer` (flat `Separator`-divided sections, divergent wallpaper),
while direct chats use the polished accordion `ConversationSettingsDrawer`.

### Current state (read)
- `ConversationHeader` routes groups to `GroupSettingsDrawer` and directs to `ConversationSettingsDrawer`
  (lines 173, 197-204). `ConversationSettingsDrawer` **already has an accordion** (Chat Info /
  Action Options / Customize Chat / Files & Media / Privacy & Support) and **already handles groups**
  partially (membersCount, rename/avatar via `onOpenGroupInfo`, leave group stub).
- `GroupSettingsDrawer` has the real member-management UI (list with resolved names, add/remove, avatar
  upload, leave, links to shared-media/KB/AI-persona) but in a non-accordion layout and with the
  divergent wallpaper grid.

### Recommended approach
Make the **group** settings use the accordion structure for parity, while preserving
`GroupSettingsDrawer`'s member-management capabilities. Two viable options:

**Option A (preferred):** Refactor `GroupSettingsDrawer` to the same `Accordion` layout as
`ConversationSettingsDrawer`, with sections:
- **Chat Info:** group avatar + name (inline edit, admin-only), member count, member list (resolved
  names via `GroupMemberRow`), add-member search (admin-only).
- **Customize Chat:** wallpaper (open `WallpaperPickerModal` — fixes W-15.2 divergence), quick reaction
  (W-15.3), rename group / change avatar (admin).
- **Media/Files:** shared media, knowledge base links (existing buttons).
- **Privacy & Support:** AI persona (admin), leave group (destructive).

**Option B:** Have groups also use `ConversationSettingsDrawer` and embed the member-management UI into
its Customize/Chat-Info accordions, then delete `GroupSettingsDrawer`. Cleaner long-term but larger
blast radius (header wiring, GroupReadDetails, etc.).

→ **Go with Option A** (lower risk, keeps existing member logic intact).

### Files
| File | Change | Detail |
|------|--------|--------|
| `apps/web/components/chat/GroupSettingsDrawer.tsx` | 수정(대규모) | Convert flat layout → `Accordion type="multiple"` with the 4 sections above. Keep all existing handlers (`handleSaveName`, `handleAddMember`, `handleRemoveMember`, `handleLeaveGroup`, `handleAvatarUpload`, `GroupMemberRow`). **Replace** the inline `WALLPAPER_PRESETS` grid (lines 58-65, 91-95, 193-196, 315-337) with a "Change Wallpaper" button → `WallpaperPickerModal` (consistency w/ W-15.2). Add quick-reaction picker (W-15.3). Watch the 400-line file limit — if exceeded, extract `GroupMemberRow` + section bodies into `apps/web/components/chat/group/*` subcomponents. |
| `apps/web/messages/{7 locales}.json` | 수정 | Reuse existing accordion category keys (`chatInfoCategory`, `customizeChatCategory`, `filesAndMediaCategory`, `privacyAndSupportCategory` — already present from W-11.8). Add any group-specific labels not yet present. |

### Notes / Edge cases
- Admin-gating: name edit, avatar change, add/remove member, AI persona link = admin only
  (`conversation.admins.includes(currentUserId)`); keep current gating.
- "Leave Group" stays destructive + confirm dialog. The `ConversationSettingsDrawer` group branch also
  has a `leaveGroup` stub (line 441) — after this refactor groups route only to `GroupSettingsDrawer`,
  so that stub becomes dead for groups (leave it for safety or remove if unreachable).
- Reuse `WallpaperPickerModal` and the new quick-reaction picker — do not duplicate.
- Keep file ≤ 400 lines (clean-code rule) — extraction likely needed.

### Done criteria
- Group settings sidebar shows 4 collapsible Messenger-style sections; every button/toggle works
  (rename, avatar, add/remove member, wallpaper via modal, quick reaction, shared media, KB, AI persona,
  leave group).
- Wallpaper for groups uses the same upload+preview modal as direct chats (W-15.2 consistency).
- `tsc --noEmit` clean; file ≤ 400 lines (or split).

---

## Library / dependency changes
**None.** All work uses existing deps (shadcn Accordion/Dialog/Sheet/Slider, lucide-react, next-intl,
TanStack Query, sonner). Emoji pickers reuse the existing curated-emoji popover pattern from
`MessageInput.tsx` (no new emoji library — consistent with W-9.10's "no new dep" decision).

## Backend changes
**None across all 5 tasks.** Quick reaction, nicknames, and wallpaper are client-side localStorage +
`system.*` message broadcast (verified against Flutter `chat_provider.dart`). The `system` message type
already flows through `POST /api/messages` and STOMP unchanged.

## Implementation order (dependency-aware)
1. **W-15.1** — create `lib/system-messages.ts` (shared humanizer) + sidebar preview. *(Foundation:
   the humanizer is reused by sidebar in 15.3/15.4/15.5 for new system codes.)*
2. **W-15.3** — create `lib/quick-reaction.ts` + wire picker + composer. *(Independent; needed before
   15.5's Customize section.)*
3. **W-15.4** — extend nickname editor (both users) + apply nickname in sidebar/bubbles. *(Builds on
   existing `lib/nicknames.ts`; independent of 15.3.)*
4. **W-15.2** — wallpaper preview modal upgrade + group wallpaper unification. *(Needed before 15.5,
   which routes group wallpaper through the same modal.)*
5. **W-15.5** — group settings accordion refactor. *(Last: consumes the WallpaperPickerModal from 15.2
   and the quick-reaction picker from 15.3.)*

After each task: `cd apps/web && npx tsc --noEmit` (and `pnpm build` after the last). Update
`apps/web/messages/*.json` for all 7 locales per `.claude/rules/i18n.md` (vi+en full, others stub).

## Global edge cases / sync risks
- **Format parity with Flutter is mandatory** — keep `system.theme.changed:`, `system.nickname.changed:<id>:<nick>`,
  `system.quick_reaction.changed:<emoji>` byte-for-byte (Flutter parses these). Do NOT invent new prefixes.
- All three localStorage keys are **per-conversation** — clearing one conversation must not affect others.
- `MessageBubble` adding a `conversationId` prop: grep call sites first (only the conversation page found).
- Media URLs always via `absoluteMediaUrl()` (`lib/media.ts`) — the wallpaper 404 fix depends on this.
- `next-intl` keys must exist in all 7 files or build/runtime falls back to the key string.
