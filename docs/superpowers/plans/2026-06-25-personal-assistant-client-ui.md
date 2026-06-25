# Personal Assistant — Client UI Plan (Web + Flutter)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:orchestrate-feature` (web + mobile parity required per `sync.md`) or `superpowers:executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Bot Factory personal assistant *visible and usable* for members inside PON — both on web (Next.js) and Flutter. The server-side bridge (Phase 1) is already live; this plan wires the UI on top of it.

**What the user experiences after this plan:**
1. A persistent "Trợ lý của tôi" entry in the sidebar/home that is always one tap away.
2. Tapping it opens the 1-1 conversation with their personal assistant (auto-created if needed).
3. Messages sent by the bot (`senderId` starts with `extbot:`) render with a distinct bot avatar and name — NOT the generic `@AI` bubble and NOT a human bubble.
4. No extra setup required by the member — the admin already registered the mapping via `POST /api/admin/external-bots`.
5. If no assistant is registered for this member, the entry is hidden (graceful no-op).

**API contract (already live in chat-service):**
- `GET /api/assistant/me` → `{ botUserId, name, avatarUrl }` or `404` when unregistered.
- `POST /api/conversations` with `{ "participantId": "extbot:<id>" }` → existing conversation or new one (auto-accepted, no stranger banner).

**Sync rule:** Every change on web MUST be mirrored on Flutter in the same commit/task. A feature that exists on one platform only is considered broken (`.claude/rules/sync.md`).

---

## Global Constraints

- **Web:** App Router, `'use client'` only when needed, TanStack Query for server data, `chatApi` axios instance, shadcn/ui, Tailwind, `next-intl` for i18n, max 400 lines/file.
- **Flutter:** Feature-based structure `lib/features/assistant/{data,state,ui}/`, Riverpod + `ConsumerWidget`, `chatDio` for chat-service calls, go_router navigation, all 7 ARB locale files.
- **i18n:** Every user-visible string goes into `messages/*.json` (web) AND `lib/l10n/app_*.arb` (Flutter). No hardcoded strings.
- **Bot identity:** `senderId` starting with `extbot:` = personal assistant bot. The UI must derive the display name and avatar from the `AssistantResponse` returned by `GET /api/assistant/me`, NOT from the users collection (the bot is not a real user).
- **Do NOT touch** `apps/server/auth-service/` or the Bot Factory repo.
- **Build verify after each task:** `pnpm build` (web) + `flutter analyze` (Flutter) must be clean before committing.

All web paths are relative to `apps/web/`. All Flutter paths are relative to `apps/client/`.

---

## Task 1 — API client + hooks (Web & Flutter)

Add the typed API layer for `GET /api/assistant/me` and the "open or create" conversation call on both platforms.

**Files:**
- Create: `apps/web/lib/api/assistant.ts`
- Create: `apps/web/lib/hooks/use-assistant.ts`
- Create: `apps/client/lib/features/assistant/data/assistant_repository.dart`
- Create: `apps/client/lib/features/assistant/state/assistant_provider.dart`

**Interfaces produced:**
- Web: `AssistantInfo { botUserId: string; name: string; avatarUrl: string | null }` — exported type + `fetchAssistant(): Promise<AssistantInfo | null>` (returns null on 404).
- Web: `useAssistant()` hook → `{ data: AssistantInfo | null | undefined, isLoading, isError }` via TanStack Query, key `['assistant', 'me']`.
- Flutter: `AssistantInfo` model (freezed or plain class), `AssistantRepository.fetchAssistant()` → `AssistantInfo?`, `assistantProvider` (AsyncNotifier returning `AssistantInfo?`).

- [ ] **Step 1 — Web: create `lib/api/assistant.ts`**

```ts
// lib/api/assistant.ts
import { chatApi } from './axios'

export interface AssistantInfo {
  botUserId: string
  name: string
  avatarUrl: string | null
}

/** Returns null when no assistant is registered for the current member (404). */
export async function fetchAssistant(): Promise<AssistantInfo | null> {
  try {
    const res = await chatApi.get<AssistantInfo>('/api/assistant/me')
    return res.data
  } catch (err: any) {
    if (err?.response?.status === 404) return null
    throw err
  }
}
```

- [ ] **Step 2 — Web: create `lib/hooks/use-assistant.ts`**

```ts
// lib/hooks/use-assistant.ts
'use client'
import { useQuery } from '@tanstack/react-query'
import { fetchAssistant, type AssistantInfo } from '@/lib/api/assistant'

export function useAssistant() {
  return useQuery<AssistantInfo | null>({
    queryKey: ['assistant', 'me'],
    queryFn: fetchAssistant,
    staleTime: 5 * 60 * 1000, // 5 min — assistant mapping changes rarely
  })
}
```

- [ ] **Step 3 — Flutter: create `lib/features/assistant/data/assistant_repository.dart`**

```dart
// lib/features/assistant/data/assistant_repository.dart
import 'package:dio/dio.dart';

class AssistantInfo {
  final String botUserId;
  final String name;
  final String? avatarUrl;

  const AssistantInfo({
    required this.botUserId,
    required this.name,
    this.avatarUrl,
  });

  factory AssistantInfo.fromJson(Map<String, dynamic> json) => AssistantInfo(
        botUserId: json['botUserId'] as String,
        name: json['name'] as String,
        avatarUrl: json['avatarUrl'] as String?,
      );
}

class AssistantRepository {
  final Dio _dio;
  const AssistantRepository(this._dio);

  /// Returns null when no assistant is registered for the current member (404).
  Future<AssistantInfo?> fetchAssistant() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/api/assistant/me');
      return AssistantInfo.fromJson(res.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }
}
```

- [ ] **Step 4 — Flutter: create `lib/features/assistant/state/assistant_provider.dart`**

```dart
// lib/features/assistant/state/assistant_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/assistant_repository.dart';
import '../../../core/api/dio_client.dart'; // chatDio provider

final assistantRepositoryProvider = Provider<AssistantRepository>(
  (ref) => AssistantRepository(ref.watch(chatDioProvider)),
);

final assistantProvider = AsyncNotifierProvider<AssistantNotifier, AssistantInfo?>(
  AssistantNotifier.new,
);

class AssistantNotifier extends AsyncNotifier<AssistantInfo?> {
  @override
  Future<AssistantInfo?> build() =>
      ref.read(assistantRepositoryProvider).fetchAssistant();
}
```

- [ ] **Step 5 — Build verify**
  - Web: `cd apps/web && pnpm build` — must pass.
  - Flutter: `cd apps/client && flutter analyze` — No issues found.

- [ ] **Step 6 — Commit**
```bash
git add apps/web/lib/api/assistant.ts \
        apps/web/lib/hooks/use-assistant.ts \
        apps/client/lib/features/assistant/data/assistant_repository.dart \
        apps/client/lib/features/assistant/state/assistant_provider.dart
git commit -m "feat(assistant): API client + hooks for personal assistant (web + Flutter)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2 — Bot message rendering (Web & Flutter)

Messages from a personal assistant bot (`senderId` starts with `extbot:`) must render differently from both human messages and the native `@AI` messages. Visual target: a distinct teal/purple gradient avatar with the bot's name, left-aligned bubble (same side as AI), no read receipts, no reactions toolbar.

**Files:**
- Modify: `apps/web/components/chat/MessageBubble.tsx`
- Modify: `apps/web/lib/api/types.ts` (add `isExternalBot` helper if not already present)
- Modify: `apps/client/lib/features/chat/ui/widgets/message_bubble.dart`
- Modify: `apps/client/lib/features/chat/ui/widgets/ai_message_parts.dart`

**Rule:** The component receives `message.senderId`. If `senderId.startsWith('extbot:')` → render as external bot. The display name and avatar come from `useAssistant()` (web) / `assistantProvider` (Flutter) — NOT from a user lookup.

- [ ] **Step 1 — Web: add `isExternalBot` helper in `lib/api/types.ts`**

In the existing `types.ts`, add near the AI bot helper:
```ts
export const isExternalBot = (senderId: string) => senderId.startsWith('extbot:')
```

- [ ] **Step 2 — Web: update `MessageBubble.tsx`**

In `components/chat/MessageBubble.tsx`, import `useAssistant` and `isExternalBot`. Add a branch **before** the existing AI bubble branch:

```tsx
// At the top of the component (after existing hooks):
const { data: assistant } = useAssistant()

// In JSX, add before the isAiMessage block:
if (isExternalBot(message.senderId)) {
  return (
    <div className="flex items-start gap-2 mb-3">
      {/* Bot avatar */}
      <div className="size-8 rounded-full bg-gradient-to-br from-violet-500 to-teal-400
                      flex items-center justify-center text-white text-xs font-bold shrink-0">
        {assistant?.name?.[0]?.toUpperCase() ?? '🤖'}
      </div>
      <div className="flex flex-col gap-1 max-w-[70%]">
        {/* Bot name label */}
        <span className="text-xs text-muted-foreground font-medium pl-1">
          {assistant?.name ?? t('assistant.defaultName')}
        </span>
        {/* Bubble — same style as AI bubble */}
        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed">
          <MessageContent message={message} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3 — Flutter: update `message_bubble.dart`**

In `message_bubble.dart`, import the assistant provider and add a branch for external bot messages. The check: `message.senderId.startsWith('extbot:')`.

The external bot bubble uses the same layout as the AI bubble (left-aligned, no tail on the right) but with:
- Avatar: `CircleAvatar` with violet-to-teal gradient background, initial letter of bot name.
- Name label above the bubble: bot name from `assistantProvider`.
- Bubble color: `Theme.of(context).colorScheme.surfaceVariant` (same as AI bubble).
- No reactions bar, no read status icon.

```dart
// In message_bubble.dart — add helper
bool get _isExternalBot => widget.message.senderId.startsWith('extbot:');

// In build(), add before the existing _isAiMessage branch:
if (_isExternalBot) {
  final assistantAsync = ref.watch(assistantProvider);
  final botName = assistantAsync.valueOrNull?.name ?? 'Assistant';
  return _ExternalBotBubble(message: widget.message, botName: botName);
}
```

Create a private widget `_ExternalBotBubble` in `ai_message_parts.dart` (keeps message_bubble.dart < 400 lines):
```dart
class _ExternalBotBubble extends StatelessWidget {
  final dynamic message; // use the existing Message type in the codebase
  final String botName;
  const _ExternalBotBubble({required this.message, required this.botName});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Gradient avatar
        Container(
          width: 32, height: 32,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              colors: [Color(0xFF7C3AED), Color(0xFF14B8A6)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Center(
            child: Text(
              botName[0].toUpperCase(),
              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Bot name label
              Padding(
                padding: const EdgeInsets.only(left: 4, bottom: 2),
                child: Text(botName,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        )),
              ),
              // Bubble
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceVariant,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(4),
                    topRight: Radius.circular(16),
                    bottomLeft: Radius.circular(16),
                    bottomRight: Radius.circular(16),
                  ),
                ),
                child: TextContent(message: message),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
```

- [ ] **Step 4 — Build verify**
  - Web: `cd apps/web && pnpm build` — must pass.
  - Flutter: `cd apps/client && flutter analyze` — No issues found.

- [ ] **Step 5 — Commit**
```bash
git add apps/web/components/chat/MessageBubble.tsx \
        apps/web/lib/api/types.ts \
        apps/client/lib/features/chat/ui/widgets/message_bubble.dart \
        apps/client/lib/features/chat/ui/widgets/ai_message_parts.dart
git commit -m "feat(assistant): render external bot messages with distinct identity

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3 — "Trợ lý của tôi" entry point (Web sidebar + Flutter home)

Add a persistent, always-visible entry that lets a member open a 1-1 conversation with their personal assistant in one tap. Hidden gracefully when `GET /api/assistant/me` returns 404.

**Files:**
- Create: `apps/web/components/chat/AssistantEntry.tsx`
- Modify: `apps/web/app/(main)/layout.tsx`
- Create: `apps/client/lib/features/assistant/ui/assistant_entry_tile.dart`
- Modify: `apps/client/lib/features/chat/ui/conversation_list_screen.dart`
- Modify (i18n): `apps/web/messages/en.json` + all locale files; `apps/client/lib/l10n/app_en.arb` + all 6 locale ARB files.

**Behaviour:**
1. Component calls `useAssistant()` / `assistantProvider`.
2. If `data == null` (404 or loading) → render nothing.
3. If assistant exists → render a pinned entry at the top of the conversation list: gradient bot avatar, bot name, subtitle "Trợ lý cá nhân của bạn".
4. On tap:
   a. Call `POST /api/conversations` with `{ participantId: assistant.botUserId }`.
   b. Navigate to the returned `conversationId`.
   c. If conversation already exists the server returns it (idempotent).

- [ ] **Step 1 — i18n strings**

Add to `apps/web/messages/en.json` (and all 6 other locale files — `vi`, `zh`, `ja`, `ko`, `es`, `fr`):
```json
"assistant": {
  "defaultName": "My Assistant",
  "subtitle": "Your personal assistant",
  "openChat": "Open assistant chat"
}
```

Add to `apps/client/lib/l10n/app_en.arb` (and all 6 other ARB files):
```json
"assistantDefaultName": "My Assistant",
"assistantSubtitle": "Your personal assistant",
"assistantOpenChat": "Open assistant chat"
```

- [ ] **Step 2 — Web: create `components/chat/AssistantEntry.tsx`**

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAssistant } from '@/lib/hooks/use-assistant'
import { chatApi } from '@/lib/api/axios'

export function AssistantEntry() {
  const { data: assistant } = useAssistant()
  const router = useRouter()
  const t = useTranslations('assistant')

  if (!assistant) return null

  async function handleOpen() {
    const res = await chatApi.post('/api/conversations', {
      participantId: assistant!.botUserId,
    })
    const convId = res.data?.id ?? res.data?._id
    if (convId) router.push(`/conversations/${convId}`)
  }

  return (
    <button
      onClick={handleOpen}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                 hover:bg-accent transition-colors text-left mb-1"
      aria-label={t('openChat')}
    >
      {/* Gradient avatar */}
      <div className="size-10 rounded-full bg-gradient-to-br from-violet-500 to-teal-400
                      flex items-center justify-center text-white font-bold text-sm shrink-0">
        {assistant.name[0].toUpperCase()}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-semibold truncate">{assistant.name}</span>
        <span className="text-xs text-muted-foreground truncate">{t('subtitle')}</span>
      </div>
    </button>
  )
}
```

- [ ] **Step 3 — Web: add `AssistantEntry` to `app/(main)/layout.tsx`**

In the sidebar section (the `<div>` that already contains `<ConversationList>`), add `<AssistantEntry />` immediately above `<ConversationList />`:

```tsx
import { AssistantEntry } from '@/components/chat/AssistantEntry'
// ...
<AssistantEntry />
<ConversationList />
```

- [ ] **Step 4 — Flutter: create `lib/features/assistant/ui/assistant_entry_tile.dart`**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../state/assistant_provider.dart';
import '../../../core/api/dio_client.dart'; // chatDioProvider

class AssistantEntryTile extends ConsumerWidget {
  const AssistantEntryTile({super.key});

  Future<void> _openChat(BuildContext context, WidgetRef ref, String botUserId) async {
    final dio = ref.read(chatDioProvider);
    try {
      final res = await dio.post('/api/conversations', data: {'participantId': botUserId});
      final convId = res.data['id'] ?? res.data['_id'];
      if (context.mounted) context.push('/conversations/$convId');
    } catch (_) {
      // graceful — if it fails the user can retry
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assistantAsync = ref.watch(assistantProvider);
    return assistantAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (assistant) {
        if (assistant == null) return const SizedBox.shrink();
        final l10n = AppLocalizations.of(context)!;
        return ListTile(
          leading: Container(
            width: 44, height: 44,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [Color(0xFF7C3AED), Color(0xFF14B8A6)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Center(
              child: Text(
                assistant.name[0].toUpperCase(),
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          title: Text(assistant.name,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          subtitle: Text(l10n.assistantSubtitle,
              style: Theme.of(context).textTheme.bodySmall),
          onTap: () => _openChat(context, ref, assistant.botUserId),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        );
      },
    );
  }
}
```

- [ ] **Step 5 — Flutter: insert `AssistantEntryTile` in `conversation_list_screen.dart`**

In `conversation_list_screen.dart`, add `const AssistantEntryTile()` as the first item in the list/column, before the existing conversation list widget, inside a `Column` or `ListView` header slot. Import the tile from `assistant/ui/assistant_entry_tile.dart`.

- [ ] **Step 6 — Build verify**
  - Web: `cd apps/web && pnpm build` — must pass.
  - Flutter: `cd apps/client && flutter analyze` — No issues found.

- [ ] **Step 7 — Commit**
```bash
git add apps/web/components/chat/AssistantEntry.tsx \
        apps/web/app/\(main\)/layout.tsx \
        apps/web/messages/ \
        apps/client/lib/features/assistant/ui/assistant_entry_tile.dart \
        apps/client/lib/features/chat/ui/conversation_list_screen.dart \
        apps/client/lib/l10n/
git commit -m "feat(assistant): personal assistant entry point in sidebar + Flutter home

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4 — "Thinking..." indicator while bot is replying

Bot Factory calls are synchronous and take 2–10 seconds. During this time the user should see a subtle "typing" indicator so the UI doesn't feel frozen.

**Files:**
- Modify: `apps/web/app/(main)/conversations/[id]/page.tsx`
- Modify: `apps/client/lib/features/chat/ui/chat_screen.dart`

**Behaviour:** When the last message in a 1-1 conversation is from the member (i.e., no reply yet from `extbot:*`) AND the conversation partner is an external bot, show the existing `ChatTypingIndicator` / `ChatTypingIndicator` widget (already built for the `@AI` streaming path). The indicator auto-dismisses when the STOMP broadcast of the bot reply arrives.

- [ ] **Step 1 — Web: `conversations/[id]/page.tsx`**

The page already has logic to detect when the AI bot is typing (for `@AI` streaming). Add a parallel check: if `otherParticipant?.startsWith('extbot:')` AND `lastMessage.senderId === currentUser.id` (i.e., user just sent something) → show the typing indicator. The indicator clears on the next STOMP message received in the conversation (existing logic already clears it).

Locate the block where `isAiTyping` is set and add alongside it:
```tsx
const isAssistantTyping =
  isExternalBot(otherParticipantId ?? '') &&
  lastMessage?.senderId === user?.id
```

Pass `isAssistantTyping || isAiTyping` to the `<ChatTypingIndicator>` (or equivalent) component.

- [ ] **Step 2 — Flutter: `chat_screen.dart`**

The existing `StreamingAiBubble` / typing state handles `@AI`. Add the same check for external bot conversations:
```dart
final isAssistantConversation = _otherParticipantId?.startsWith('extbot:') ?? false;
final isAssistantTyping = isAssistantConversation && _lastMessageIsFromCurrentUser;
```

Pass this flag to the existing `ChatTypingIndicator` widget already present in the chat widget tree.

- [ ] **Step 3 — Build verify**
  - Web: `pnpm build` — must pass.
  - Flutter: `flutter analyze` — No issues found.

- [ ] **Step 4 — Commit**
```bash
git add apps/web/app/\(main\)/conversations/\[id\]/page.tsx \
        apps/client/lib/features/chat/ui/chat_screen.dart
git commit -m "feat(assistant): show typing indicator while personal assistant is replying

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Manual end-to-end verification (after all tasks)

With infra up, chat-service running with valid `BOTFACTORY_BASE_URL` + `BOTFACTORY_WORKER_TOKEN`, and a member whose assistant is registered:

1. **Web:** Login as member → sidebar shows "Trợ lý của tôi" entry above conversation list.
2. **Tap/click** → opens or creates the 1-1 conversation; status `accepted` (no stranger banner).
3. **Send a message** → typing indicator appears within 1s.
4. **Bot replies** within a few seconds → message renders with gradient avatar + bot name, left-aligned bubble, distinct from `@AI` and human messages.
5. **Flutter:** same flow — `AssistantEntryTile` visible at top of conversation list, same render on both platforms.
6. **Member with no assistant registered:** entry is completely hidden on both platforms.

---

## Out of scope (follow-up plans)

- **Identity bridge** (personal assistant accessing company data via connector-service) — requires PON token issuance, separate plan.
- **Auto-provisioning** (member gets a bot automatically on first login) — Phase 4 of the bridge plan.
- **Admin UI** to manage bot registrations — Phase 4.
- **Group @mention** for Bot Factory bots — Phase 2 of the bridge plan.
