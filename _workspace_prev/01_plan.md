# SPRINT M-15 — Mobile Chat UI/UX Refinement — Implementation Plan

> **Scope:** Mobile (Flutter, `apps/client/`) **ONLY**. No backend, no web changes.
> Follow-up to SPRINT W-15. Flutter is the **source of truth** for the system-message
> formats and the localStorage/shared_preferences key conventions that the web mirrored.

---

## 0. Format parity verification vs. W-15 (`_workspace_prev/01_plan.md`)

I read the actual Flutter source. **Flutter is the origin — all three formats already match the web plan byte-for-byte.** No format changes needed.

| Concern | Flutter storage key (`SharedPreferences`) | System message format | Source file:line |
|---------|-------------------------------------------|-----------------------|------------------|
| Wallpaper | `chat_wallpaper_<convId>` (String) | `system.theme.changed:<value>` | `chat_provider.dart:1078,1087` ; sent at `chat_wallpaper_dialog.dart:97` |
| Nickname | `chat_nicknames_<convId>` (StringList of `userId\|nickname`) | `system.nickname.changed:<userId>:<nickname>` | `chat_provider.dart:1103,1127` ; sent at `conversation_customisation_dialogs.dart:134` |
| Quick reaction | `chat_quick_reaction_<convId>` (String, default `👍`) | `system.quick_reaction.changed:<emoji>` | `chat_provider.dart:1141,1146` ; sent at `conversation_customisation_dialogs.dart:31` |

Wallpaper fit suffix `#fit=cover|contain|fill` (`chat_wallpaper_dialog.dart:11-16`) is also already mirrored by web. The web plan's note that web "ignores unknown `&scale=`" confirms scale is a *web-only future* param — **Mobile does NOT need a `&scale=` param** unless we add interactive scale (see Task M-15.2 decision below).

**Conclusion: "Flutter is the source, already correct."** Task M-15.1 is therefore a *presentation polish* (conversation-list subtitle), not a format change. The humanisation already exists in the chat bubble (`message_bubble_parts.dart:SystemMessage`) and partially in the tile subtitle (`conversation_tile.dart:_subtitleText`).

---

## Task M-15.1 — Conversation List Subtitle Logic & System Messages Formatting

### Current state (read)
- `conversation_tile.dart:_subtitleText` (lines 223-242) ALREADY humanises `system.nickname.changed:`, `system.theme.changed:`, `system.quick_reaction.changed:`, attachments (`/api/uploads/`), and a generic `system.*` fallback. **But it has two gaps:**
  1. **No "You:" prefix.** It shows the raw last-message content for both senders. The tile already computes `currentUserId`, `isGroup`, and `conv.lastMessage!.senderId` is available (`chat_state.dart:LastMessageModel.senderId`).
  2. The generic `system.*` fallback (line 240) renders `📢 group created` style raw-ish text and does NOT map the group/member codes (`system.group.created`, `system.members.added`, `system.member.left/removed/joined`) that `message_bubble_parts.dart:_systemText` (lines 221-236) maps to proper l10n. **Divergence between bubble and tile.**
- `message_bubble_parts.dart:SystemMessage` (lines 134-237) is the richer, actor-aware humaniser (chat area). It is already correct and complete — keep as the reference behaviour.
- Strings in `_subtitleText` are **hardcoded** `isVi ? '...' : '...'` ternaries — violates i18n rule. Move to `context.l10n` keys.

### Files to modify

| File | Change |
|------|--------|
| `lib/features/chat/ui/widgets/conversation_tile.dart` | (a) Add "You:" prefix logic in the `subtitle:` builder. For **direct** chats (`!isGroup`) where `conv.lastMessage!.senderId == currentUserId`, render `context.l10n.youColon + ' ' + previewBody`. Other sender → `previewBody` only. Groups → no prefix (matches Messenger / web plan). (b) Refactor `_subtitleText` → replace hardcoded VI/EN ternaries with `context.l10n.*` keys, and extend the generic `system.*` branch to map group/member codes via the SAME switch used in `message_bubble_parts._systemText` (createGroup/addMembers/leaveGroup/removeMember/joinChannel — all keys already exist in ARB). Keep attachment + 3 customisation branches. (c) The "You:" prefix must wrap the *humanised* body, not the raw code (e.g. "You: 📎 Attachment", "You: Chat theme changed"). |
| `lib/features/chat/ui/widgets/message_bubble_parts.dart` | Minor: confirm `_systemText` already covers all group/member codes (it does, lines 221-236). No change required unless we want to share the humaniser — see "Shared helper" note. |
| `lib/l10n/app_en.arb` (+ 6 locales) | Add new keys: `youColon` ("You:"), `systemNicknameChanged` ("Nickname was changed"), `systemThemeChanged` ("Chat theme changed"), `systemQuickReactionChanged` ("Quick reaction changed"). These replace the hardcoded ternaries in `_subtitleText`. (`attachmentLabel`, `createGroup`, `addMembers`, `leaveGroup`, `removeMember`, `joinChannel` already exist — reuse.) |

### Shared helper (recommended, optional)
To avoid the tile/bubble divergence recurring, extract a top-level pure function
`String humanizeSystemCode(BuildContext ctx, String code)` into `message_bubble_parts.dart`
(or a new `lib/features/chat/ui/widgets/system_message_text.dart`) returning the **short,
non-actor** form (tile uses short form; bubble keeps its richer actor-aware form). Low priority —
the simpler path is to keep `_subtitleText` self-contained but i18n-clean. **Decision: keep
`_subtitleText` self-contained** (smaller blast radius, both files already < 400 lines, clean-code OK).

### Done criteria (M-15.1)
- Direct chat, I sent last msg "hello" → tile subtitle = "You: hello".
- Direct chat, they sent "hello" → tile subtitle = "hello".
- Group chat → no "You:" prefix (raw body / humanised system text).
- Last message `system.theme.changed:...` → "Chat theme changed" (or "You: Chat theme changed").
- Last message `system.group.created` → "Create group" (l10n), not `📢 group created`.
- No hardcoded VI/EN ternary left in `_subtitleText`.
- `flutter analyze` clean; `flutter gen-l10n` regenerates without errors.

---

## Task M-15.2 — Chat Background Upload Fix & Interactive Preview Modal

### ROOT CAUSE of the upload bug (found by code reading — no run needed)

`chat_repository.uploadFile` (line 351-366) returns a **relative** URL: `data['url']`
(e.g. `/api/uploads/<file>`), NOT an absolute `http...` URL. Two render/decision sites
assume `http`-prefixed strings and therefore **break for uploaded wallpapers**:

1. **`chat_wallpaper_dialog.dart:85`** — `bool get _isImage => _selected.startsWith('http');`
   A relative `/api/uploads/...` URL returns **false**, so the picked image is never treated
   as an image: preview falls back to "Default", the fit selector never shows, and `#fit=`
   never gets encoded. (Web works only because `WallpaperPickerModal` runs everything through
   `absoluteMediaUrl()` first.)
2. **`chat_screen.dart:431`** — `else if (wallpaper.startsWith('http'))` then
   `Image.network(parsed.value, ...)` at line 437 with **NO** `absoluteMediaUrl()`. A relative
   URL (a) fails the `startsWith('http')` gate entirely, and (b) even if it passed, would 404
   because the host/port prefix is missing.
3. `chat_provider.dart` (lines 434/502/537) stores `system.theme.changed:` URL verbatim into
   `chatWallpaperProvider` — also assumes the value is directly renderable.

**The correct, existing fix primitive:** `absoluteMediaUrl(url)` in
`lib/features/chat/ui/widgets/image_content.dart:10` — `if (url.startsWith('http')) return url; return '${DioClient.chatBaseUrl}$url';`. This is exactly the web's `lib/media.ts:absoluteMediaUrl`.

### Fix strategy (Task M-15.2 part 1)
- Treat a wallpaper value as an image when it is **not empty, not `preset:`** (i.e. any uploaded
  URL whether relative or absolute), not only when it `startsWith('http')`.
- Always render uploaded wallpapers through `absoluteMediaUrl()` at the two render sites
  (`chat_wallpaper_dialog._buildPreview` Image.network, and `chat_screen` Image.network).
- Keep storing the value as returned (relative is fine — `absoluteMediaUrl` resolves at render).
  This keeps the stored `system.theme.changed:<value>` byte-for-byte parity with web (web also
  stores the value it gets from upload; both resolve at render). **No format change.**
- Surface upload errors: the `catch (_)` at `chat_wallpaper_dialog.dart:114` silently swallows.
  Add a `SnackBar` / inline error using a new l10n key (`wallpaperUploadError`) — Flutter rule
  "never silently swallow exceptions".

### Interactive Preview Modal (Task M-15.2 part 2)

**Requirement:** Do NOT apply on upload. After picking, open a preview with a **mock chat
interface + dummy messages over the new background**, allow **adjust / crop / scale**, and apply
the exact adjusted image only on **Submit/Save**.

**Current state:** `_WallpaperDialog` already (a) does NOT apply on upload — only on `_confirm`
(line 89-99), (b) shows a small live preview (`_buildPreview`), (c) has a cover/contain/fill fit
selector. So the **deferred-apply contract already exists**. Gaps vs. the requirement:
1. Preview is a plain image box, not a **mock chat with dummy bubbles**.
2. No **scale / crop / reposition** — only the 3 BoxFit presets.

**Decision on cropping approach (package evaluation):**
`pubspec.yaml` has `image_picker: ^1.1.2` only — no crop/zoom package.

- Option A — add `image_cropper: ^8.x`: native crop UI (iOS/Android), returns a cropped file we
  re-upload. Pros: real pixel crop. Cons: heavyweight native dep, its own full-screen UI replaces
  our "mock chat preview" requirement (can't overlay dummy bubbles inside its native screen),
  Android needs `UCropActivity` manifest entry, iOS pod. Higher risk.
- **Option B — `InteractiveViewer` + saved transform (CHOSEN):** Wrap the background image in an
  `InteractiveViewer` (pan + pinch-zoom) inside our OWN preview panel that renders dummy chat
  bubbles on top — this *directly satisfies* "mockup chat interface with dummy messages over the
  background" + "adjust/crop/scale within this modal". Encode the chosen scale (and optionally
  alignment) into the stored value as an extra suffix `#fit=<fit>&scale=<n>` — **exactly the
  param the web plan reserved** ("Flutter ignores unknown `&scale=`" → now Flutter writes/reads
  it; web already parses it → full parity). No new package. No native config. Uses framework
  widgets already in Flutter. Lower risk, satisfies the spec, keeps clean-code.

→ **Go with Option B.** No new package required. If the user later demands a true destructive
pixel-crop, revisit Option A.

**Encoding extension** (keep backward compatible):
- Extend `splitWallpaperFit` → `splitWallpaperLayout(raw)` returning `(value, fit, scale)`.
  Parse `#fit=<fit>` (existing) and optional `&scale=<double>` after it. Default `scale = 1.0`.
  Old values with only `#fit=cover` and bare URLs/presets still parse (backward compat).
- `_confirm` writes `'<value>#fit=<fit>&scale=<scale>'` only for uploaded images when fit≠cover
  or scale≠1.0; presets/default unchanged.
- `chat_screen` render: apply `scale` via `Transform.scale` (or `InteractiveViewer` initial
  matrix) wrapping the wallpaper `Image.network` so the saved zoom is reproduced.

### Files to modify / create

| File | Change |
|------|--------|
| `lib/features/chat/ui/widgets/chat_wallpaper_dialog.dart` | (1) `_isImage` → treat any non-empty, non-`preset:`, non-default value as image (covers relative URLs). (2) `_buildPreview` → render image via `Image.network(absoluteMediaUrl(_selected), ...)`; **replace the plain box with a mock-chat preview**: a stack of 3-4 dummy `_DummyBubble` rows (1 incoming left, 2 outgoing right) over the background, wrapped in `InteractiveViewer` for pan/zoom. (3) Add a **scale slider** (`Slider` 1.0–3.0) below the fit selector when image is selected; store `_scale`. (4) `_confirm` → encode `#fit=<fit>&scale=<scale>`. (5) `_uploadImage` catch → show error via `ScaffoldMessenger` + `context.l10n.wallpaperUploadError` instead of silent swallow. (6) Extract the dummy-bubble preview widget into a private `_WallpaperMockPreview` widget if the file approaches 400 lines (clean-code; currently 318 — adding the mock + slider may push past 400 → **plan to extract** `_WallpaperMockPreview` into a new file `chat_wallpaper_preview.dart`). |
| `lib/features/chat/ui/widgets/chat_wallpaper_preview.dart` | **NEW** (if needed for 400-line limit) — `WallpaperMockPreview` stateless widget: takes `imageProvider`/url, `fit`, `scale`; renders the dummy mock-chat over the background. Reusable, keeps dialog file lean. |
| `lib/features/chat/ui/chat_screen.dart` | (1) wallpaper image branch: use `absoluteMediaUrl(parsed.value)` in `Image.network` (line 437) — **the actual 404 fix**. (2) Broaden the image gate so a relative `/api/uploads/...` value is rendered as an image, not dropped (currently `startsWith('http')` — change to "not empty && not preset" or check `parsed.value` after split). (3) Apply saved `scale` via `Transform.scale`/`InteractiveViewer` matrix. |
| `lib/features/chat/data/chat_repository.dart` | No change needed — `uploadFile` already returns the URL; relative is fine now that render sites resolve it. (Confirm `/api/uploads` endpoint returns `url` — it does, line 365.) |
| `lib/l10n/app_en.arb` (+ 6 locales) | Add `wallpaperUploadError` ("Failed to upload image"), `wallpaperScale` ("Scale"), `wallpaperPreviewHint` ("Pinch or drag to adjust") plus dummy-bubble sample strings if not reusing literals — prefer 2 keys `wallpaperPreviewIncoming` ("Hi! How does this look?") / `wallpaperPreviewOutgoing` ("Looks great 🎉") for the mock messages (i18n rule: no hardcoded UI strings). |

### Notes / Edge cases
- `splitWallpaperLayout` must be backward compatible: existing stored `...#fit=contain` (no scale)
  and bare URLs/`preset:` must still parse. Default scale 1.0.
- Stored value parity: web parses `#fit=` and `&scale=` → unchanged contract, now Flutter writes
  scale too. Web already tolerates it. Mobile reading a web-saved scale works.
- `absoluteMediaUrl` import: `chat_screen.dart` and `chat_wallpaper_dialog.dart` must import it from
  `widgets/image_content.dart`. Never hand-concatenate the base URL.
- Cancel/close must NOT persist — already correct (apply only in `_confirm`). Preserve.
- Preview opacity in live chat is 0.25 (chat_screen line 435) — keep for chat; mock preview in the
  dialog should show the image at FULL opacity so the user judges the real picture, with dummy
  bubbles styled like the neon theme for realism.

### Done criteria (M-15.2)
- Uploading an image now shows it (no broken-image / Default fallback) — relative URL resolved via `absoluteMediaUrl`.
- Picking an image opens the preview showing a **mock chat with dummy bubbles over the image**, with **pinch/drag (InteractiveViewer) + a scale slider + fit selector**.
- Adjusted scale/fit persist (`#fit=<fit>&scale=<n>`) and reproduce exactly in the live chat background.
- Cancel does not change wallpaper; Save broadcasts `system.theme.changed:<value>` (unchanged format).
- Upload failure shows a visible error (no silent swallow).
- `flutter analyze` clean; each touched file ≤ 400 lines (extract `WallpaperMockPreview` if needed).

---

## New package decision (summary)
**None required.** Crop/scale uses Flutter built-in `InteractiveViewer` + `Transform.scale` +
`Slider` (Option B). `image_picker` (already present) handles picking. Avoided `image_cropper`
because its native full-screen UI conflicts with the "mock-chat-over-background preview" requirement
and adds native config/risk. If a true destructive pixel crop is later mandated, add
`image_cropper: ^8.x` then.

---

## Step-by-step implementation order (dependency-aware)

1. **ARB keys first** — add all new keys (`youColon`, `systemNicknameChanged`, `systemThemeChanged`,
   `systemQuickReactionChanged`, `wallpaperUploadError`, `wallpaperScale`, `wallpaperPreviewHint`,
   `wallpaperPreviewIncoming`, `wallpaperPreviewOutgoing`) to `app_en.arb` (template, with `@`
   metadata where placeholders are used — none here) then to all 6 other locales (vi = full
   translation; zh/ja/ko/es/fr = real translations following the existing convention, English
   acceptable as stub but match existing files which DO translate common keys). Run `flutter gen-l10n`.
2. **M-15.1 tile subtitle** — edit `conversation_tile.dart`: "You:" prefix + i18n-clean
   `_subtitleText` + group/member code mapping. (Independent of M-15.2.)
3. **M-15.2 upload fix (core)** — add `absoluteMediaUrl` at the two render sites + broaden image
   gate in `chat_screen.dart` and `chat_wallpaper_dialog.dart`. This alone repairs uploads.
4. **M-15.2 preview modal** — build `WallpaperMockPreview` (new file) with dummy bubbles +
   `InteractiveViewer`; add scale slider; extend `splitWallpaperFit`→`splitWallpaperLayout` with
   `&scale=`; update `_confirm` encoding and `chat_screen` to apply saved scale; add error surfacing.
5. **Verify** — `flutter gen-l10n` then `flutter analyze` (expect clean) and, if available,
   `flutter test`. Manually confirm tile subtitle + wallpaper upload/preview/save round-trip.

After each task: re-run `flutter analyze`. Keep every touched file ≤ 400 lines (clean-code).

---

## Global edge cases / sync risks
- **Format parity is mandatory** — `system.theme.changed:`, `system.nickname.changed:<id>:<nick>`,
  `system.quick_reaction.changed:<emoji>` stay byte-for-byte (web parses them). The only additive
  change is the wallpaper value's `&scale=` suffix, which web already tolerates/parses → safe.
- All three SharedPreferences keys are **per-conversation** — never cross-write.
- `absoluteMediaUrl` everywhere for media — the wallpaper 404 fix depends on it; never hand-build URLs.
- New ARB keys must exist in all 7 files or runtime falls back to the key string.
- `flutter gen-l10n` is mandatory after ARB edits; generated `app_localizations*.dart` are never hand-edited.
