# Web Implementation Report — SPRINT W-15

All 5 tasks implemented per `_workspace/01_plan.md`. `npx tsc --noEmit` clean (0 errors),
`npx eslint` clean (0 warnings), `npx next build` succeeds.

## Implemented files

### New files
- `apps/web/lib/system-messages.ts` — `humanizeSystemMessage(content, t, opts?)`: shared
  humanizer for all `system.*` codes + attachment detection. Single source of truth for
  sidebar + chat bubble. Mirrors Flutter `message_bubble_parts.dart:_systemText` +
  `conversation_tile.dart:_subtitleText`.
- `apps/web/lib/quick-reaction.ts` — mirror of `lib/nicknames.ts`: `getQuickReaction` (default
  `'👍'`), `setQuickReaction`, `quickReactionSystemMessage`, `applyQuickReactionSystemMessage`,
  `useQuickReaction` reactive hook. Storage key `chat_quick_reaction_<convId>`,
  `QUICK_REACTION_EVENT` dispatch.
- `apps/web/components/chat/group/GroupMemberRow.tsx` — extracted from GroupSettingsDrawer.
- `apps/web/components/chat/group/SettingsHeader.tsx` — avatar + name + quick-action row
  (extracted from ConversationSettingsDrawer for the 400-line limit).
- `apps/web/components/chat/group/ActionOptionsSection.tsx` — mark read/unread, archive,
  auto-delete (extracted).
- `apps/web/components/chat/group/CustomizeChatSection.tsx` — wallpaper, quick-reaction picker,
  two-row nickname editor (extracted; shared by direct settings).
- `apps/web/components/chat/group/FilesMediaSection.tsx` — media/files/links (extracted).
- `apps/web/components/chat/group/PrivacySupportSection.tsx` — block/leave/clear/delete (extracted).

### Modified files
- `apps/web/components/chat/ConversationItem.tsx` (W-15.1 + W-15.4) — `previewText` helper:
  `"You: "` prefix for own last message in direct chats, system codes/attachments humanised via
  `humanizeSystemMessage(..., { short: true })`; direct-chat display name now prefers
  `useNickname(conv.id, otherUserId)`. Empty state → `t('noMessagesYet')`.
- `apps/web/components/chat/MessageBubble.tsx` (W-15.1 + W-15.4) — replaced inline 3-branch
  system humaniser with `humanizeSystemMessage`; added optional `conversationId` prop; sender
  label + reply-preview sender now resolve `useNickname` before falling back to `senderName`.
- `apps/web/components/chat/MessageInput.tsx` (W-15.3) — quick-reaction send button uses
  `useQuickReaction(conversation.id)` instead of hard-coded `👍`.
- `apps/web/components/chat/ConversationSettingsDrawer.tsx` (W-15.3 + W-15.4 + clean-code) —
  replaced "Coming soon" quick-reaction stub with an emoji-picker Popover wired to
  `setQuickReaction` + `system.quick_reaction.changed:` broadcast; replaced single nickname
  input with a two-row editor (them + you). Refactored into the extracted `group/*` sections to
  satisfy the 400-line limit (now 357 lines).
- `apps/web/components/chat/WallpaperPickerModal.tsx` (W-15.2) — mock-chat live preview (dummy
  incoming/outgoing bubbles over the background), scale slider (50–200%), upload error toast
  (`wallpaperUploadError`). Encodes `#fit=<fit>&scale=<n>`; `splitFit` upgraded to URLSearchParams.
- `apps/web/components/chat/GroupSettingsDrawer.tsx` (W-15.2 + W-15.5) — full Accordion refactor
  (Chat Info / Customize Chat / Files & Media / Privacy & Support). Inline flat-key
  `WALLPAPER_PRESETS` grid removed → "Change Wallpaper" button opens `WallpaperPickerModal` (same
  flow + storage format as direct chats). Quick-reaction picker added. 369 lines (under 400);
  `GroupMemberRow` extracted.
- `apps/web/app/(main)/conversations/[id]/page.tsx` (W-15.2 + W-15.3 + W-15.4) — `resolveWallpaper`
  parses `&scale=` (backward-compatible; `cover` keyword preserved at default scale);
  `applyQuickReactionSystemMessage` added to both historical-seeding and STOMP handlers;
  `conversationId={id}` passed to `<MessageBubble>`.
- `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json` — 17 new keys added to all 7 locales
  (en + vi full translations, others English stub per `.claude/rules/i18n.md`).

## TypeScript type check result
- errors: **0** (`npx tsc --noEmit`)
- eslint: **0** warnings/errors
- `npx next build`: compiled successfully, all 24 routes generated

## i18n added keys (en text)
- `youColon`: "You: "
- `noMessagesYet`: "No messages yet"
- `conversationDefault`: "Conversation"
- `attachmentLabel`: "[Attachment]"
- `systemQuickReactionChangedShort`: "Quick reaction changed"
- `systemGroupCreated`: "Group created"
- `systemMembersAdded`: "Members added"
- `systemMemberLeft`: "A member left the group"
- `systemMemberRemoved`: "A member was removed"
- `systemMemberJoined`: "A member joined"
- `wallpaperUploadError`: "Failed to upload image"
- `wallpaperScale`: "Scale"
- `wallpaperPreview`: "Preview"
- `quickReactionSuccess`: "Quick reaction updated"
- `quickReactionPickTitle`: "Pick a quick reaction"
- `nicknameYou`: "Your nickname"
- `nicknameOther`: "Their nickname"

(All present in all 7 locale files — verified 17/17 per file.)

## Cross-platform format parity (byte-for-byte with Flutter)
- `system.theme.changed:<value>` — sent on wallpaper confirm (unchanged format; Flutter ignores
  the new `&scale=` suffix since it reads the URL before `#`).
- `system.nickname.changed:<userId>:<nickname>` — two-row editor broadcasts for both targetIds
  (including self).
- `system.quick_reaction.changed:<emoji>` — picker broadcasts; `applyQuickReactionSystemMessage`
  splits only after the first `:` (emoji contains no `:`).

## Flutter mirror sync confirmation
- `MessageBubble.tsx` ↔ `message_bubble_parts.dart`: ✓ (humanizer covers the same system codes;
  group/member codes now render in the bubble, previously raw)
- `ConversationItem.tsx` ↔ `conversation_tile.dart`: ✓ (`/api/uploads/` attachment label,
  system humanise, nickname-aware display name, `You:` prefix)
- `WallpaperPickerModal.tsx` ↔ `chat_wallpaper_dialog.dart`: ✓ (presets + upload + fit;
  web adds scale as a non-breaking `&scale=` suffix)
- `quick-reaction.ts` ↔ `chat_provider.dart` `QuickReactionNotifier`: ✓ (default `👍`,
  per-conversation storage, system broadcast)
- `GroupSettingsDrawer.tsx` ↔ Flutter group settings: ✓ (Accordion sections, unified wallpaper)

## Notes / remaining items
- The group "Leave Group" entry in `ConversationSettingsDrawer` (`onLeaveGroup` →
  `toast('Coming soon')`) is now dead for groups, since the header routes groups to
  `GroupSettingsDrawer` (which has the real leave handler). Left in place per plan (safe).
- `cover` background-size at the default scale (100%) keeps the `cover` keyword so legacy
  `#fit=cover` wallpapers render identically; a non-default scale switches to an explicit `%`.
- `ConversationSettingsDrawer` was over 400 lines after the W-15.3/W-15.4 additions; split into
  `components/chat/group/*` per clean-code rule. All resulting files are under 400 lines.
- No backend changes (all client-side localStorage + `system.*` broadcast, as planned).
