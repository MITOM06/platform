# Cross-Platform Sync Rule — Web ↔ Mobile

> **This is a messaging app. Web (Next.js) and mobile (Flutter) MUST be in sync at all times.**
> Read this file before touching any UI feature on either platform.

## Core Principle

Any feature, UI change, or bug fix on one platform MUST be reflected on the other.
A feature that works on mobile but not web (or vice versa) is considered **broken**.

Examples:
- Web adds nickname editing → Flutter must also support it (or already does)
- Flutter shows user profile on avatar tap → Web must show the same
- Web sends a message type → Flutter must render it correctly, and vice versa

## Before You Start Any Task

1. **Identify the mirror file**: every web component has a Flutter equivalent.
   - `apps/web/components/chat/MessageBubble.tsx` ↔ `apps/client/lib/features/chat/ui/widgets/message_bubble.dart`
   - `apps/web/components/chat/MessageInput.tsx` ↔ `apps/client/lib/features/chat/ui/widgets/chat_input_bar.dart`
   - `apps/web/app/(main)/conversations/[id]/page.tsx` ↔ `apps/client/lib/features/chat/ui/chat_screen.dart`
   - `apps/web/components/chat/ConversationHeader.tsx` ↔ `apps/client/lib/features/chat/ui/widgets/chat_app_bar.dart`
   - `apps/web/app/(main)/friends/page.tsx` ↔ `apps/client/lib/features/friends/ui/friends_screen.dart`
   - `apps/web/app/(main)/settings/page.tsx` ↔ `apps/client/lib/features/settings/ui/settings_screen.dart`
   - Meetings (web MT4–MT5, Flutter MT6–MT7 — both done):
     - `apps/web/app/(main)/meetings/page.tsx` ↔ `apps/client/lib/features/meetings/ui/meetings_screen.dart`
     - `apps/web/app/(main)/meetings/[id]/page.tsx` ↔ `apps/client/lib/features/meetings/ui/meeting_detail_screen.dart`
     - `apps/web/app/(main)/meet/[code]/page.tsx` ↔ `apps/client/lib/features/meetings/ui/room/meeting_room_screen.dart`
     - `apps/web/lib/meetings/meeting-room-controller.ts` ↔ `apps/client/lib/features/meetings/state/meeting_room_controller.dart`
       (split on mobile into `room_media.dart` + `room_commands.dart`; `meeting-room-chat.ts` ↔ `state/meeting_room_chat.dart`,
       `room-session.ts` ↔ `state/meeting_room_deps.dart` + `state/room_session_wiring.dart`, `room-sync.ts` ↔ `state/room_sync.dart`,
       `active-room.ts` ↔ `state/active_room.dart`)
     - Pure logic: `apps/web/lib/meetings/<name>.ts` ↔ `apps/client/lib/features/meetings/domain/<name>.dart` (same name,
       kebab → snake: `meeting-errors`, `meeting-events`, `cache-updates`, `schedule`, `meeting-form`, `meeting-code`,
       `attendance`, `permissions`, `note-sync`, `room-phase`, `stage-layout`, `reactions`, `room-host`, `room-events`,
       `display`; `devices.ts` ↔ `device_prefs.dart`; `lib/realtime/meeting-queue.ts` ↔ `domain/meeting_queue.dart`)
     - `apps/web/components/meeting/NotesEditor.tsx` ↔ `apps/client/lib/features/meetings/ui/widgets/notes_editor.dart` (+ `note_tab.dart`)
     - Room UI: `apps/web/components/meeting/room/<Name>.tsx` ↔ `apps/client/lib/features/meetings/ui/room/<name>.dart` —
       `MeetingSession` ↔ `meeting_session_view`, `PreJoinLobby` ↔ `prejoin_screen`, `PrejoinPreview` (+ `DeviceSelects`) ↔
       `prejoin_preview`, `WaitingScreen` ↔ `waiting_screen`, `RoomStatusScreen` ↔ `room_status_screen`, `MeetingRoom` ↔
       `meeting_room_view` (+ `room_banners`), `MeetingStage` ↔ `meeting_stage`, `MeetingTile` ↔ `meeting_tile`
       (+ `tile_badges`), `ControlBar` ↔ `control_bar`, `ControlBarMore` ↔ `room_more_sheet`, `LeaveMenu` ↔ `leave_sheet`,
       `ReactionPicker` / `ReactionOverlay` ↔ `reaction_picker` / `reaction_overlay`, `SidePanel` ↔ `room_panels`
       (+ `room_sheet`), `ParticipantsPanel` ↔ `participants_sheet`, `LobbySection` ↔ `lobby_section`, `ParticipantRow` ↔
       `participant_row`, `HostMenu` ↔ `host_actions_sheet`, `RoomManageMenu` ↔ `room_manage_section`,
       `MeetingChatPanel` / `MeetingChatLines` / `MeetingChatComposer` ↔ `meeting_chat_sheet` / `chat_lines` /
       `chat_composer`, `NotesPanel` ↔ `notes_sheet`. Web-only (no mobile mirror): `RemoteAudio` (native WebRTC plays
       audio), `MicLevel`, `RoomDevicesDialog`, `shortcuts.ts`.

2. **Read the mirror file** before implementing. Match the logic, not just the UI.

3. **Check the API contract**: both platforms call the same backend. If one platform is broken,
   look at the API response shape first (`docs/api-spec.md`).

## Sync Checklist (run after any UI/feature change)

- [ ] Does the feature work end-to-end on the modified platform?
- [ ] Does the mirror platform render the result correctly?
- [ ] Is the message type handled in BOTH `MessageBubble.tsx` AND `message_bubble.dart`?
- [ ] Are STOMP events handled in BOTH `conversations/[id]/page.tsx` AND `chat_screen.dart`?
- [ ] Does i18n/l10n cover the new strings? (web: `messages/*.json`, mobile: `lib/l10n/app_*.arb`)
- [ ] Do colours, type and spacing follow `docs/design-system.md`? Web is the visual source of
      truth — a token changes on web first, then in `app_theme.dart` in the same PR.

## Real-Time Message Pipeline (must stay in sync on both platforms)

```
User sends → POST /api/messages (REST) → chat-service saves + publishes STOMP
         → STOMP /topic/conversation/{id} → Web + Mobile both receive
         → Both render identically
```

If a message type renders on web but not mobile, or vice versa — it's a **P1 bug**.

## Platform Notes

| Concern | Web | Mobile |
|---------|-----|--------|
| Auth state | Zustand `auth.store.ts` | Riverpod `auth_provider.dart` |
| API base | `NEXT_PUBLIC_CHAT_URL` | `AppConfig.chatBaseUrl` |
| STOMP client | `lib/stomp/client.ts` | `lib/core/services/stomp_service.dart` |
| Media URLs | `lib/media.ts` `absoluteMediaUrl()` | `lib/core/utils/media_url.dart` |
| i18n | `next-intl`, `messages/*.json` | Flutter ARB `lib/l10n/app_*.arb` |
| Design tokens | `app/globals.css` | `lib/core/theme/app_theme.dart` |
