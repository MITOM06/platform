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

2. **Read the mirror file** before implementing. Match the logic, not just the UI.

3. **Check the API contract**: both platforms call the same backend. If one platform is broken,
   look at the API response shape first (`docs/api-spec.md`).

## Sync Checklist (run after any UI/feature change)

- [ ] Does the feature work end-to-end on the modified platform?
- [ ] Does the mirror platform render the result correctly?
- [ ] Is the message type handled in BOTH `MessageBubble.tsx` AND `message_bubble.dart`?
- [ ] Are STOMP events handled in BOTH `conversations/[id]/page.tsx` AND `chat_screen.dart`?
- [ ] Does i18n/l10n cover the new strings? (web: `messages/*.json`, mobile: `lib/l10n/app_*.arb`)

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
