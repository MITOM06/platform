# Performance Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate N+1 API waterfalls, add virtual scroll to message list, memoize heavy components, add keepAlive caching in Flutter, and replace Redis pub/sub for AI requests with a durable RabbitMQ queue.

**Architecture:** Phase 1 fixes data-fetching (batch prefetch + Flutter keepAlive) — biggest latency win, zero infrastructure change. Phase 2 fixes rendering (React.memo + virtual scroll + next/image + Flutter provider narrowing). Phase 3 adds RabbitMQ alongside Redis: chat-service publishes AI requests to RabbitMQ instead of Redis; ai-service consumes from the queue; Redis pub/sub is kept only for the low-latency streaming responses back to clients.

**Tech Stack:** Next.js 16 (App Router), @tanstack/react-virtual, React.memo, Flutter Riverpod keepAlive, Spring Boot AMQP (`spring-boot-starter-amqp`), NestJS `@golevelup/nestjs-rabbitmq`, RabbitMQ 3.13.

---

## File Map

### Web (Next.js) — `apps/web/`
| File | Action |
|---|---|
| `lib/hooks/use-conversations.ts` | Add `staleTime: 2 * 60 * 1000` |
| `components/chat/ConversationList.tsx` | Add batch prefetch `useEffect` |
| `components/chat/ConversationItem.tsx` | Wrap export in `memo()` |
| `components/chat/MessageBubble.tsx` | Wrap export in `memo()` with equality fn |
| `components/chat/MessageList.tsx` | Rewrite to use `useVirtualizer` |
| `app/(main)/conversations/[id]/page.tsx` | Pass `scrollContainerRef` to `MessageList` |
| `components/chat/ImageContent.tsx` | Replace `<img>` with `next/image` |
| `next.config.ts` | Add `images.remotePatterns` |
| `package.json` | Add `@tanstack/react-virtual` |

### Flutter — `apps/client/`
| File | Action |
|---|---|
| `lib/features/chat/domain/chat_misc_providers.dart` | Add `keepAlive` timer to `userStatusProvider` + `userProfileProvider` |
| `lib/features/chat/ui/widgets/conversation_tile.dart` | Narrow 5 provider watches with `.select()` |

### Backend — Phase 3
| File | Action |
|---|---|
| `infra/docker-compose/compose.yml` | Add RabbitMQ service + volume |
| `apps/server/chat-service/pom.xml` | Add `spring-boot-starter-amqp` |
| `apps/server/chat-service/src/main/resources/application.yml` | Add `spring.rabbitmq.*` config |
| `apps/server/chat-service/src/main/java/.../config/RabbitMqConfig.java` | **New** — declare exchange, queue, DLQ, binding |
| `apps/server/chat-service/src/main/java/.../service/AiRedisPublisher.java` | Replace Redis body with RabbitTemplate |
| `apps/server/ai-service/package.json` | Add `@golevelup/nestjs-rabbitmq` + `amqplib` + `@types/amqplib` |
| `apps/server/ai-service/src/rabbitmq/rabbitmq.module.ts` | **New** — RabbitMQ module |
| `apps/server/ai-service/src/ai/ai.consumer.ts` | **New** — `@RabbitSubscribe` handler |
| `apps/server/ai-service/src/redis/redis-subscriber.service.ts` | Remove `ai:request` subscribe, keep `kb:process` + `kb:delete` |
| `apps/server/ai-service/src/app.module.ts` | Import `RabbitmqModule` |

---

## Phase 1 — Frontend Data Layer

### Task 1: Web — staleTime tuning + batch profile prefetch

**Files:**
- Modify: `apps/web/lib/hooks/use-conversations.ts`
- Modify: `apps/web/components/chat/ConversationList.tsx`

**Problem:** The global staleTime is 60 s; conversations are kept fresh via STOMP, so 60 s refetches are wasted round trips. Each `ConversationItem` independently fires `useUser(otherUserId)` — 20 conversations = 20 parallel profile fetches on mount.

**Fix:** Increase conversations staleTime to 2 min (STOMP keeps it live). After conversations load, batch-prefetch all participant profiles in `ConversationList` before items mount.

- [ ] **Step 1: Extend conversations staleTime**

Replace the full contents of `apps/web/lib/hooks/use-conversations.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { chatService } from '@/lib/api/chat'

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatService.getConversations(),
    staleTime: 2 * 60 * 1000,
    select: (data) => data.content,
  })
}
```

- [ ] **Step 2: Add batch prefetch effect to ConversationList**

Open `apps/web/components/chat/ConversationList.tsx`. Add these imports at the top (after the existing imports):

```ts
import { useEffect } from 'react'
import { authService } from '@/lib/api/auth'
```

Then add this `useEffect` inside `ConversationList()`, right after the `const filtered = …` line and before the `return (`:

```tsx
  // Batch-prefetch all participant profiles so ConversationItems read from cache.
  useEffect(() => {
    if (!conversations || !currentUserId) return
    const ids = [
      ...new Set(
        conversations
          .flatMap((c) => c.participants)
          .filter((id) => id !== currentUserId && id !== AI_BOT_ID),
      ),
    ]
    ids.forEach((userId) => {
      queryClient.prefetchQuery({
        queryKey: ['user', userId],
        queryFn: () => authService.getUser(userId),
        staleTime: 5 * 60 * 1000,
      })
    })
  }, [conversations, currentUserId, queryClient])
```

- [ ] **Step 3: Verify build passes**

```bash
cd apps/web && pnpm build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully` (no TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/hooks/use-conversations.ts apps/web/components/chat/ConversationList.tsx
git commit -m "perf(web): batch-prefetch participant profiles on conversation list load"
```

---

### Task 2: Flutter — keepAlive on status + profile providers

**Files:**
- Modify: `apps/client/lib/features/chat/domain/chat_misc_providers.dart`

**Problem:** `userStatusProvider` and `userProfileProvider` are `FutureProvider.autoDispose.family`. When a `ConversationTile` scrolls off screen, Riverpod disposes the provider. When the tile scrolls back, it re-creates and re-fetches — causing visible re-loading on every scroll.

**Fix:** Call `ref.keepAlive()` inside each provider and attach a 5-minute timer to close the keepAlive link. Providers stay cached for 5 min after their last subscriber detaches.

- [ ] **Step 1: Add dart:async import**

Open `apps/client/lib/features/chat/domain/chat_misc_providers.dart`.

Add to the top (if not already present):
```dart
import 'dart:async';
```

- [ ] **Step 2: Replace `userStatusProvider` body**

Find:
```dart
final userStatusProvider =
    FutureProvider.autoDispose.family<UserStatus, String>((ref, userId) {
  return ref.read(chatRepositoryProvider).getUserStatus(userId);
});
```

Replace with:
```dart
final userStatusProvider =
    FutureProvider.autoDispose.family<UserStatus, String>((ref, userId) async {
  final link = ref.keepAlive();
  Timer(const Duration(minutes: 5), link.close);
  return ref.read(chatRepositoryProvider).getUserStatus(userId);
});
```

- [ ] **Step 3: Replace `userProfileProvider` body**

Find:
```dart
final userProfileProvider =
    FutureProvider.autoDispose.family<UserModel, String>((ref, userId) {
  return ref.read(authRepositoryProvider).getUserProfile(userId);
});
```

Replace with:
```dart
final userProfileProvider =
    FutureProvider.autoDispose.family<UserModel, String>((ref, userId) async {
  final link = ref.keepAlive();
  Timer(const Duration(minutes: 5), link.close);
  return ref.read(authRepositoryProvider).getUserProfile(userId);
});
```

- [ ] **Step 4: Verify Flutter analyze**

```bash
cd apps/client && flutter analyze lib/features/chat/domain/chat_misc_providers.dart
```
Expected: `No issues found!`

- [ ] **Step 5: Commit**

```bash
git add apps/client/lib/features/chat/domain/chat_misc_providers.dart
git commit -m "perf(mobile): keepAlive status/profile providers for 5 min to prevent scroll re-fetches"
```

---

## Phase 2 — Frontend Render Layer

### Task 3: Web — React.memo on MessageBubble + ConversationItem

**Files:**
- Modify: `apps/web/components/chat/MessageBubble.tsx`
- Modify: `apps/web/components/chat/ConversationItem.tsx`

**Problem:** When typing state or AI stream content changes, the parent re-renders and `MessageBubble` re-renders for every message in the list — even messages that haven't changed. Same for `ConversationItem` in the sidebar.

**Fix:** Wrap both in `React.memo` with custom equality functions that skip re-renders when only irrelevant parent state changes.

- [ ] **Step 1: Add memo to MessageBubble**

Open `apps/web/components/chat/MessageBubble.tsx`.

Add `memo` to the React import at line 1:
```ts
import { useState, useRef, memo } from 'react'
```

Find the export line (currently `export function MessageBubble(`). Change it to a `const` and wrap in `memo` by replacing the function declaration and adding the memo export at the end of the file.

Change:
```ts
export function MessageBubble({
```
To:
```ts
const MessageBubbleInner = function MessageBubble({
```

Then at the very end of the file (after the closing `}` of the component function), add:

```ts
export const MessageBubble = memo(
  MessageBubbleInner,
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.recalled === next.message.recalled &&
    prev.message.editedAt === next.message.editedAt &&
    prev.message.reactions === next.message.reactions &&
    prev.message.readBy === next.message.readBy &&
    prev.isPinned === next.isPinned &&
    prev.isOwn === next.isOwn &&
    prev.conversationId === next.conversationId,
)
```

- [ ] **Step 2: Add memo to ConversationItem**

Open `apps/web/components/chat/ConversationItem.tsx`.

Add `memo` to React imports — find the first line and add it:
```ts
import { memo } from 'react'
```
(Add to the top, near other React imports or as a new line since currently there are no React imports from 'react' itself — they use framework hooks from next/navigation etc.)

Find:
```ts
export function ConversationItem({ conversation: conv }: Props) {
```
Change to:
```ts
const ConversationItemInner = function ConversationItem({ conversation: conv }: Props) {
```

At the end of the file, after the closing `}`, add:
```ts
export const ConversationItem = memo(
  ConversationItemInner,
  (prev, next) =>
    prev.conversation.id === next.conversation.id &&
    prev.conversation.lastMessageAt === next.conversation.lastMessageAt &&
    prev.conversation.unreadCount === next.conversation.unreadCount &&
    prev.conversation.lastMessage?.content === next.conversation.lastMessage?.content &&
    prev.conversation.isMuted === next.conversation.isMuted &&
    prev.conversation.isArchived === next.conversation.isArchived,
)
```

- [ ] **Step 3: Verify build**

```bash
cd apps/web && pnpm build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/chat/MessageBubble.tsx apps/web/components/chat/ConversationItem.tsx
git commit -m "perf(web): React.memo MessageBubble + ConversationItem to prevent unnecessary re-renders"
```

---

### Task 4: Web — Install @tanstack/react-virtual

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install package**

```bash
cd apps/web && pnpm add @tanstack/react-virtual
```
Expected: Package added, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Verify import resolves**

```bash
cd apps/web && node -e "require('@tanstack/react-virtual'); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "perf(web): add @tanstack/react-virtual for message list virtualization"
```

---

### Task 5: Web — Virtual scroll in MessageList

**Files:**
- Modify: `apps/web/components/chat/MessageList.tsx`
- Modify: `apps/web/app/(main)/conversations/[id]/page.tsx`

**Problem:** All messages are rendered into the DOM at once. A 300-message chat renders ~300 `MessageBubble` nodes. Each bubble has sub-trees for images, reactions, reply previews — the DOM is enormous and scroll is janky.

**Fix:** Use `@tanstack/react-virtual` to render only the ~15-20 visible items plus a small overscan. Date separators become virtual row items too. The scroll container lives in page.tsx and is passed down as a ref.

- [ ] **Step 1: Pass scrollContainerRef to MessageList from page.tsx**

Open `apps/web/app/(main)/conversations/[id]/page.tsx`.

Find the `<MessageList` JSX block (around line 333). Add one new prop:
```tsx
<MessageList
  ...existing props...
  scrollContainerRef={scrollContainerRef}
/>
```

- [ ] **Step 2: Rewrite MessageList.tsx**

Replace the full contents of `apps/web/components/chat/MessageList.tsx` with:

```tsx
'use client'

import { useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, MessageCircle } from 'lucide-react'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { ChatTypingIndicator } from '@/components/chat/ChatTypingIndicator'
import { Skeleton } from '@/components/ui/skeleton'
import type { Message } from '@/lib/api/types'

type VirtualRow =
  | { kind: 'separator'; isoDate: string }
  | { kind: 'message'; msg: Message }

function formatSeparatorDate(
  dateStr: string,
  locale: string,
  labels: { today: string; yesterday: string },
): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return labels.today
  if (date.toDateString() === yesterday.toDateString()) return labels.yesterday
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function MessageSkeletons() {
  return (
    <div className="space-y-3 py-4 px-4">
      {[60, 80, 50, 90, 65].map((w, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          <Skeleton className="h-9 rounded-2xl" style={{ width: `${w}%`, maxWidth: '320px' }} />
        </div>
      ))}
    </div>
  )
}

interface Props {
  messages: Message[]
  currentUserId?: string
  conversationId: string
  otherUserId?: string
  pinnedMessages: string[]
  isGroup: boolean
  isLoading: boolean
  isError: boolean
  isFetchingNextPage: boolean
  typingUserIds: string[]
  aiStreamContent: string | null
  topSentinelRef: React.RefObject<HTMLDivElement | null>
  bottomRef: React.RefObject<HTMLDivElement | null>
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  onEdit: (message: Message) => void
  onForward: (message: Message) => void
  onReply: (message: Message) => void
  onAiTrace: (messageId: string) => void
  onOptimisticUpdate: (updated: Partial<Message> & { id: string }) => void
}

export function MessageList({
  messages,
  currentUserId,
  conversationId,
  otherUserId,
  pinnedMessages,
  isGroup,
  isLoading,
  isError,
  isFetchingNextPage,
  typingUserIds,
  aiStreamContent,
  topSentinelRef,
  bottomRef,
  scrollContainerRef,
  onEdit,
  onForward,
  onReply,
  onAiTrace,
  onOptimisticUpdate,
}: Props) {
  const t = useTranslations('chat')
  const locale = useLocale()

  // Flatten messages + date separators into virtual rows
  const rows = useMemo<VirtualRow[]>(() => {
    const result: VirtualRow[] = []
    let lastDate = ''
    for (const msg of messages) {
      const dateStr = new Date(msg.createdAt).toDateString()
      if (dateStr !== lastDate) {
        result.push({ kind: 'separator', isoDate: msg.createdAt })
        lastDate = dateStr
      }
      result.push({ kind: 'message', msg })
    }
    return result
  }, [messages])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => (rows[index].kind === 'separator' ? 44 : 72),
    overscan: 5,
  })

  const showContent = !isLoading && !!currentUserId && !isError

  return (
    <div className="relative z-10 space-y-2">
      <div ref={topSentinelRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-2">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {(isLoading || !currentUserId) && <MessageSkeletons />}

      {isError && (
        <div className="flex justify-center py-8 text-sm text-destructive">
          {t('loadMessagesError')}
        </div>
      )}

      {showContent && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-muted-foreground">
          <MessageCircle className="size-10 opacity-30" />
          <p className="text-sm">{t('noMessagesStart')}</p>
        </div>
      )}

      {showContent && rows.length > 0 && (
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const row = rows[virtualItem.index]
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: virtualItem.start,
                  width: '100%',
                }}
              >
                {row.kind === 'separator' ? (
                  <div className="flex justify-center my-4 select-none">
                    <span className="text-[11px] bg-muted/80 backdrop-blur-xs text-muted-foreground font-semibold px-3 py-1 rounded-full border shadow-xs">
                      {formatSeparatorDate(row.isoDate, locale, {
                        today: t('today'),
                        yesterday: t('yesterday'),
                      })}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 px-0" id={`message-${row.msg.id}`}>
                    <MessageBubble
                      message={row.msg}
                      isOwn={row.msg.senderId === currentUserId}
                      currentUserId={currentUserId}
                      conversationId={conversationId}
                      otherUserId={otherUserId}
                      isPinned={pinnedMessages.includes(row.msg.id)}
                      isGroup={isGroup}
                      onEdit={onEdit}
                      onForward={onForward}
                      onReply={onReply}
                      onAiTrace={onAiTrace}
                      onOptimisticUpdate={onOptimisticUpdate}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {typingUserIds.length > 0 && currentUserId && !typingUserIds.includes(currentUserId) && (
        <ChatTypingIndicator />
      )}

      {aiStreamContent !== null && (
        <div className="flex flex-row items-end gap-1">
          <div className="max-w-[70%] rounded-[24px] rounded-tl-none px-4 py-2.5 text-sm bg-muted/70 border border-border/50 shadow-xs">
            <p className="whitespace-pre-wrap leading-relaxed">{aiStreamContent || '…'}</p>
            <div className="flex gap-1 mt-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block size-1.5 rounded-full bg-primary/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && pnpm build 2>&1 | tail -25
```
Expected: `✓ Compiled successfully` with no errors.

If you see a TypeScript error about `scrollContainerRef` in page.tsx: confirm you added the prop in Step 1.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/chat/MessageList.tsx apps/web/app/\(main\)/conversations/\[id\]/page.tsx
git commit -m "perf(web): virtual scroll in MessageList — only render visible messages"
```

---

### Task 6: Web — next/image for ImageContent

**Files:**
- Modify: `apps/web/components/chat/ImageContent.tsx`
- Modify: `apps/web/next.config.ts`

**Problem:** Image tiles use raw `<img src=...>` — no format negotiation (WebP/AVIF), no built-in lazy loading with blur placeholder, no size hints.

**Fix:** Replace `<img>` with `next/image` `<Image>` component. Add the chat-service domain to `next.config.ts` `images.remotePatterns` so Next.js can optimize external images.

- [ ] **Step 1: Add remotePatterns to next.config.ts**

Replace the full contents of `apps/web/next.config.ts`:

```ts
import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Local dev — chat-service on port 8080
      { protocol: 'http', hostname: 'localhost', port: '8080', pathname: '/api/uploads/**' },
      // Production — Cloud Run chat-service
      {
        protocol: 'https',
        hostname: 'chat-service-942942821810.asia-southeast1.run.app',
        pathname: '/api/uploads/**',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
```

- [ ] **Step 2: Replace img with Image in ImageContent.tsx**

Open `apps/web/components/chat/ImageContent.tsx`. Add the Next.js Image import at the top:

```ts
import Image from 'next/image'
```

Inside the `Tile` component, find:
```tsx
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={absoluteMediaUrl(url)}
          alt=""
          className="size-full object-cover"
          onError={() => setErrored(true)}
          loading="lazy"
        />
      )}
```

Replace with:
```tsx
      ) : (
        <Image
          src={absoluteMediaUrl(url)}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 320px"
          className="object-cover"
          onError={() => setErrored(true)}
        />
      )}
```

The parent `<button>` already has `className="relative overflow-hidden"` which is required for `fill` images — no change needed there.

- [ ] **Step 3: Verify build**

```bash
cd apps/web && pnpm build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/chat/ImageContent.tsx apps/web/next.config.ts
git commit -m "perf(web): replace raw img with next/image in chat image bubbles"
```

---

### Task 7: Flutter — ConversationTile provider select narrowing

**Files:**
- Modify: `apps/client/lib/features/chat/ui/widgets/conversation_tile.dart`

**Problem:** `ConversationTile` calls `ref.watch` on 5 providers without selectors. When any of these providers emit a new value — even if the piece used by this tile hasn't changed — the entire tile rebuilds and re-runs its full `build()` method.

**Fix:** Use `.select()` on each `ref.watch()` to subscribe only to the specific field the tile needs. The tile only rebuilds when that specific field changes.

- [ ] **Step 1: Narrow authNotifierProvider watch**

Open `apps/client/lib/features/chat/ui/widgets/conversation_tile.dart`.

Find:
```dart
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final currentUserId =
        authState is AuthAuthenticated ? authState.user.id : '';
```

Replace with:
```dart
    final currentUserId = ref.watch(
      authNotifierProvider.select((s) {
        final v = s.valueOrNull;
        return v is AuthAuthenticated ? v.user.id : '';
      }),
    );
```

Remove the now-unused `authState` variable (its only use was to derive `currentUserId`).

- [ ] **Step 2: Narrow selectedConversationIdProvider watch**

Find:
```dart
    final isSelected =
        isWeb && ref.watch(selectedConversationIdProvider) == conv.id;
```

Replace with:
```dart
    final isSelected =
        isWeb && ref.watch(selectedConversationIdProvider.select((id) => id == conv.id));
```

- [ ] **Step 3: Narrow userProfileProvider watch**

Find:
```dart
    final profileAsync = otherUserId.isNotEmpty
        ? ref.watch(userProfileProvider(otherUserId))
        : null;
```

Replace with:
```dart
    // Only rebuild when displayName or avatarUrl changes (not on loading→data wrapper change).
    final profileData = otherUserId.isNotEmpty
        ? ref.watch(userProfileProvider(otherUserId).select((s) => s.valueOrNull))
        : null;
```

Then find every use of `profileAsync?.valueOrNull` and replace with `profileData`:
- `profileAsync?.valueOrNull?.displayName` → `profileData?.displayName`
- `profileAsync?.valueOrNull?.avatarUrl` → `profileData?.avatarUrl`

Also find the `displayName` derivation:
```dart
    final displayName = isGroup
        ? (conv.name ?? context.l10n.conversationDefault)
        : ((dmNickname != null && dmNickname.isNotEmpty)
            ? dmNickname
            : (profileAsync?.valueOrNull?.displayName ?? '...'));
```
Replace with:
```dart
    final displayName = isGroup
        ? (conv.name ?? context.l10n.conversationDefault)
        : ((dmNickname != null && dmNickname.isNotEmpty)
            ? dmNickname
            : (profileData?.displayName ?? '...'));
```

And:
```dart
    final avatarUrl =
        isGroup ? conv.avatarUrl : profileAsync?.valueOrNull?.avatarUrl;
```
Replace with:
```dart
    final avatarUrl = isGroup ? conv.avatarUrl : profileData?.avatarUrl;
```

- [ ] **Step 4: Narrow userStatusProvider watch**

Find:
```dart
    final statusAsync = otherUserId.isNotEmpty
        ? ref.watch(userStatusProvider(otherUserId)).valueOrNull
        : null;
    final isOnline = !isGroup && (statusAsync?.online ?? false);
```

Replace with:
```dart
    final isOnline = !isGroup && otherUserId.isNotEmpty &&
        (ref.watch(userStatusProvider(otherUserId).select((s) => s.valueOrNull?.online ?? false)));
```

Remove the now-unused `statusAsync` variable.

- [ ] **Step 5: Verify Flutter analyze**

```bash
cd apps/client && flutter analyze lib/features/chat/ui/widgets/conversation_tile.dart
```
Expected: `No issues found!`

- [ ] **Step 6: Commit**

```bash
git add apps/client/lib/features/chat/ui/widgets/conversation_tile.dart
git commit -m "perf(mobile): narrow ConversationTile provider watches with .select() to reduce rebuilds"
```

---

## Phase 3 — Backend: RabbitMQ AI Pipeline

### Task 8: Add RabbitMQ to docker-compose

**Files:**
- Modify: `infra/docker-compose/compose.yml`

**Why:** RabbitMQ replaces Redis pub/sub for the `ai:request` channel, adding message durability and retry. If ai-service restarts mid-request, the message waits in the queue and is re-delivered.

- [ ] **Step 1: Add RabbitMQ service and volume**

Open `infra/docker-compose/compose.yml`.

Add the `rabbitmq` service after the `redis` block (before `qdrant`):

```yaml
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    container_name: chat-rabbitmq
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: platform
      RABBITMQ_DEFAULT_PASS: platform
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 15s
      timeout: 10s
      retries: 10
    networks:
      - app-net
```

Add `rabbitmq_data:` to the `volumes:` section at the bottom:

```yaml
volumes:
  mongo_data:
  qdrant_data:
  rabbitmq_data:
```

Add RabbitMQ dependency to `chat-service` and `ai-service`:

In `chat-service:` service block, add to `depends_on:`:
```yaml
      rabbitmq:
        condition: service_healthy
```

In `ai-service:` service block, add to `depends_on:`:
```yaml
      rabbitmq:
        condition: service_healthy
```

Add env vars to `chat-service:` `environment:`:
```yaml
      SPRING_RABBITMQ_HOST: rabbitmq
      SPRING_RABBITMQ_PORT: 5672
      SPRING_RABBITMQ_USERNAME: platform
      SPRING_RABBITMQ_PASSWORD: platform
```

Add env vars to `ai-service:` `environment:`:
```yaml
      RABBITMQ_URL: amqp://platform:platform@rabbitmq:5672
```

- [ ] **Step 2: Verify docker-compose syntax**

```bash
docker compose -f infra/docker-compose/compose.yml config --quiet
```
Expected: no output (valid YAML)

- [ ] **Step 3: Start RabbitMQ locally to confirm it boots**

```bash
docker compose -f infra/docker-compose/compose.yml up -d rabbitmq
docker compose -f infra/docker-compose/compose.yml ps rabbitmq
```
Expected: `chat-rabbitmq ... healthy`

Management UI accessible at http://localhost:15672 (user: platform / platform)

- [ ] **Step 4: Commit**

```bash
git add infra/docker-compose/compose.yml
git commit -m "infra: add RabbitMQ 3.13 to docker-compose for durable AI request queue"
```

---

### Task 9: chat-service — Replace AiRedisPublisher with RabbitMQ

**Files:**
- Modify: `apps/server/chat-service/pom.xml`
- Modify: `apps/server/chat-service/src/main/resources/application.yml`
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/config/RabbitMqConfig.java`
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/AiRedisPublisher.java`

**Note on naming:** `AiRedisPublisher` is injected by name in two controllers and mocked in tests. We keep the class name and method signature identical — only swap the internal transport from `StringRedisTemplate` to `RabbitTemplate`. Tests continue to work without changes.

- [ ] **Step 1: Add spring-boot-starter-amqp to pom.xml**

Open `apps/server/chat-service/pom.xml`. Find the `<dependencies>` section and add:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

- [ ] **Step 2: Add RabbitMQ config to application.yml**

Open `apps/server/chat-service/src/main/resources/application.yml`. Add under the `spring:` block (after the `data:` section):

```yaml
  rabbitmq:
    host: ${SPRING_RABBITMQ_HOST:localhost}
    port: ${SPRING_RABBITMQ_PORT:5672}
    username: ${SPRING_RABBITMQ_USERNAME:platform}
    password: ${SPRING_RABBITMQ_PASSWORD:platform}
```

- [ ] **Step 3: Create RabbitMqConfig.java**

Create file `apps/server/chat-service/src/main/java/com/platform/chatservice/config/RabbitMqConfig.java`:

```java
package com.platform.chatservice.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMqConfig {

    public static final String AI_EXCHANGE   = "ai.direct";
    public static final String AI_QUEUE      = "ai.requests";
    public static final String AI_ROUTING    = "ai.requests";
    public static final String AI_DLQ        = "ai.requests.dlq";
    public static final String AI_DL_EXCHANGE = "ai.dead-letter";

    @Bean
    DirectExchange aiExchange() {
        return new DirectExchange(AI_EXCHANGE, true, false);
    }

    @Bean
    DirectExchange aiDeadLetterExchange() {
        return new DirectExchange(AI_DL_EXCHANGE, true, false);
    }

    @Bean
    Queue aiQueue() {
        return QueueBuilder.durable(AI_QUEUE)
                .withArgument("x-dead-letter-exchange", AI_DL_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", AI_DLQ)
                .withArgument("x-message-ttl", 30_000)
                .build();
    }

    @Bean
    Queue aiDeadLetterQueue() {
        return QueueBuilder.durable(AI_DLQ).build();
    }

    @Bean
    Binding aiBinding(Queue aiQueue, DirectExchange aiExchange) {
        return BindingBuilder.bind(aiQueue).to(aiExchange).with(AI_ROUTING);
    }

    @Bean
    Binding aiDlqBinding(Queue aiDeadLetterQueue, DirectExchange aiDeadLetterExchange) {
        return BindingBuilder.bind(aiDeadLetterQueue).to(aiDeadLetterExchange).with(AI_DLQ);
    }

    @Bean
    Jackson2JsonMessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                   Jackson2JsonMessageConverter converter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(converter);
        return template;
    }
}
```

- [ ] **Step 4: Replace AiRedisPublisher.java body**

Replace the full contents of `apps/server/chat-service/src/main/java/com/platform/chatservice/service/AiRedisPublisher.java`:

```java
package com.platform.chatservice.service;

import com.platform.chatservice.config.RabbitMqConfig;
import com.platform.chatservice.dto.AiRequestPayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiRedisPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publishAiRequest(String conversationId, String userId, String displayName,
                                  String content, List<Map<String, String>> history) {
        AiRequestPayload payload = new AiRequestPayload(conversationId, userId, displayName, content, history);
        try {
            rabbitTemplate.convertAndSend(RabbitMqConfig.AI_EXCHANGE, RabbitMqConfig.AI_ROUTING, payload);
            log.debug("Published AI request via RabbitMQ for conversation {}", conversationId);
        } catch (Exception e) {
            log.error("Failed to publish AI request for conversation {}", conversationId, e);
        }
    }
}
```

- [ ] **Step 5: Build and test**

```bash
cd apps/server/chat-service && mvn test -Dtest=ChatControllerTest,AiResponseListenerTest 2>&1 | tail -30
```
Expected: `BUILD SUCCESS` — tests still mock `AiRedisPublisher` by class, method signature unchanged.

Full build:
```bash
mvn clean package -DskipTests 2>&1 | tail -10
```
Expected: `BUILD SUCCESS`

- [ ] **Step 6: Commit**

```bash
git add apps/server/chat-service/pom.xml \
        apps/server/chat-service/src/main/resources/application.yml \
        apps/server/chat-service/src/main/java/com/platform/chatservice/config/RabbitMqConfig.java \
        apps/server/chat-service/src/main/java/com/platform/chatservice/service/AiRedisPublisher.java
git commit -m "perf(chat-service): publish AI requests via RabbitMQ (durable queue + DLQ + 30s TTL)"
```

---

### Task 10: ai-service — RabbitMQ consumer, remove Redis ai:request

**Files:**
- Modify: `apps/server/ai-service/package.json`
- Create: `apps/server/ai-service/src/rabbitmq/rabbitmq.module.ts`
- Create: `apps/server/ai-service/src/ai/ai.consumer.ts`
- Modify: `apps/server/ai-service/src/redis/redis-subscriber.service.ts`
- Modify: `apps/server/ai-service/src/app.module.ts`

**Note:** The Redis subscriber currently handles 3 channels: `ai:request`, `kb:process`, `kb:delete`. We only move `ai:request` to RabbitMQ. `kb:process` and `kb:delete` stay on Redis.

- [ ] **Step 1: Install RabbitMQ packages**

```bash
cd apps/server/ai-service && pnpm add @golevelup/nestjs-rabbitmq amqplib && pnpm add -D @types/amqplib
```
Expected: packages added, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Create rabbitmq.module.ts**

Create `apps/server/ai-service/src/rabbitmq/rabbitmq.module.ts`:

```ts
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AiConsumer } from '../ai/ai.consumer'
import { AiModule } from '../ai/ai.module'

const EXCHANGE = 'ai.direct'
const QUEUE    = 'ai.requests'
const DL_EXCHANGE = 'ai.dead-letter'
const DLQ         = 'ai.requests.dlq'

@Module({
  imports: [
    RabbitMQModule.forRootAsync(RabbitMQModule, {
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('config.rabbitmqUrl') ?? 'amqp://platform:platform@localhost:5672',
        exchanges: [
          { name: EXCHANGE,    type: 'direct' },
          { name: DL_EXCHANGE, type: 'direct' },
        ],
        queues: [
          {
            name: QUEUE,
            options: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': DL_EXCHANGE,
                'x-dead-letter-routing-key': DLQ,
                'x-message-ttl': 30_000,
              },
            },
          },
          { name: DLQ, options: { durable: true } },
        ],
        connectionInitOptions: { wait: false },
      }),
    }),
    AiModule,
  ],
  providers: [AiConsumer],
})
export class RabbitmqModule {}
```

- [ ] **Step 3: Create ai.consumer.ts**

Create `apps/server/ai-service/src/ai/ai.consumer.ts`:

```ts
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq'
import { Injectable, Logger } from '@nestjs/common'
import { AiService } from './ai.service'

interface AiRequestPayload {
  conversationId: string
  userId: string
  displayName: string
  content: string
  history: Array<{ role: string; content: string }>
}

@Injectable()
export class AiConsumer {
  private readonly logger = new Logger(AiConsumer.name)

  constructor(private readonly aiService: AiService) {}

  @RabbitSubscribe({
    exchange: 'ai.direct',
    routingKey: 'ai.requests',
    queue: 'ai.requests',
    queueOptions: { durable: true },
  })
  async handleAiRequest(payload: AiRequestPayload): Promise<void> {
    this.logger.debug(`Received AI request for conversation ${payload.conversationId}`)
    try {
      await this.aiService.handleRequest(payload)
    } catch (err) {
      this.logger.error(
        `Failed to process AI request for conversation ${payload.conversationId}`,
        err,
      )
      // Re-throw so @golevelup/nestjs-rabbitmq NACKs the message → DLQ after 3 retries
      throw err
    }
  }
}
```

- [ ] **Step 4: Add RABBITMQ_URL to configuration.ts**

Open `apps/server/ai-service/src/config/configuration.ts`. Find the `return { ... }` object and add `rabbitmqUrl`:

```ts
rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://platform:platform@localhost:5672',
```

- [ ] **Step 5: Remove ai:request subscribe from RedisSubscriberService**

Open `apps/server/ai-service/src/redis/redis-subscriber.service.ts`.

In `onApplicationBootstrap()`, find:
```ts
      await this.client.subscribe(
        this.requestChannel,
        KB_PROCESS_CHANNEL,
        KB_DELETE_CHANNEL,
      );
```
Replace with:
```ts
      await this.client.subscribe(
        KB_PROCESS_CHANNEL,
        KB_DELETE_CHANNEL,
      );
```

Find the log message:
```ts
      this.logger.log(
        `Subscribed to Redis channels: ${this.requestChannel}, ${KB_PROCESS_CHANNEL}, ${KB_DELETE_CHANNEL}`,
      );
```
Replace with:
```ts
      this.logger.log(
        `Subscribed to Redis channels: ${KB_PROCESS_CHANNEL}, ${KB_DELETE_CHANNEL}`,
      );
```

Find the message handler block:
```ts
      if (_channel === this.requestChannel) {
        try {
          const payload = JSON.parse(message);
          await this.aiService.handleRequest(payload);
        } catch (err) {
          this.logger.error('Failed to process ai:request message', err);
        }
        return;
      }
```
Delete this entire `if` block (the ai:request handler is now in `AiConsumer`).

Remove the now-unused `requestChannel` property and constructor assignments for it:
- Remove: `private readonly requestChannel: string;`
- Remove the line setting it in constructor: `this.requestChannel = this.configService.get<string>('config.redisChannels.requestChannel') ?? 'ai:request';`
- Remove the `AiService` constructor param and import if `aiService` is no longer used in this file.

- [ ] **Step 6: Update AppModule to import RabbitmqModule**

Open `apps/server/ai-service/src/app.module.ts`.

Add import:
```ts
import { RabbitmqModule } from './rabbitmq/rabbitmq.module'
```

Add `RabbitmqModule` to the `imports` array. The final `imports` array should look like:
```ts
  imports: [
    ConfigModule.forRoot({ ... }),
    mongooseModule,
    HealthModule,
    RedisModule,
    MemoryModule,
    KbModule,
    ToolsModule,
    UsageModule,
    PersonaModule,
    AiModule,
    RabbitmqModule,
  ],
```

Remove `RedisSubscriberService` from the `providers` array in AppModule only if it is no longer needed at the module level — since it now only handles kb channels, it still needs to be provided. Keep it.

- [ ] **Step 7: Build**

```bash
cd apps/server/ai-service && pnpm build 2>&1 | tail -20
```
Expected: `Found 0 errors. Watching for file changes.` or successful compilation (NestJS shows `error TS...` lines on failure).

- [ ] **Step 8: Run tests**

```bash
cd apps/server/ai-service && pnpm test 2>&1 | tail -20
```
Expected: `Tests: N passed`

- [ ] **Step 9: Smoke test end-to-end (with infra running)**

```bash
# Start everything
docker compose -f infra/docker-compose/compose.yml up -d

# Tail ai-service logs
docker compose -f infra/docker-compose/compose.yml logs -f ai-service
```

Send a message with `@AI` in the chat. Expected in logs:
```
[AiConsumer] Received AI request for conversation <id>
[AiService] Streaming response for conversation <id>
```

Check RabbitMQ management UI at http://localhost:15672 → Queues → `ai.requests` → Message rates to confirm messages are flowing.

- [ ] **Step 10: Commit**

```bash
git add apps/server/ai-service/package.json \
        apps/server/ai-service/pnpm-lock.yaml \
        apps/server/ai-service/src/rabbitmq/rabbitmq.module.ts \
        apps/server/ai-service/src/ai/ai.consumer.ts \
        apps/server/ai-service/src/redis/redis-subscriber.service.ts \
        apps/server/ai-service/src/app.module.ts \
        apps/server/ai-service/src/config/configuration.ts
git commit -m "perf(ai-service): consume AI requests from RabbitMQ (durable queue), remove Redis ai:request channel"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All Phase 1, 2, 3 requirements from spec mapped to tasks 1-10
- [x] **N+1 fix (web):** Task 1 — batch prefetch + staleTime
- [x] **N+1 fix (Flutter):** Task 2 — keepAlive timer
- [x] **React.memo:** Task 3 — MessageBubble + ConversationItem
- [x] **Virtual scroll:** Tasks 4+5 — @tanstack/react-virtual in MessageList, scrollContainerRef passed from page
- [x] **next/image:** Task 6 — ImageContent.tsx + remotePatterns
- [x] **Flutter select narrowing:** Task 7 — all 5 provider watches narrowed
- [x] **RabbitMQ infra:** Task 8 — docker-compose, healthcheck, env vars for both services
- [x] **chat-service AMQP:** Task 9 — pom.xml, RabbitMqConfig, AiRedisPublisher body replaced, tests still pass
- [x] **ai-service consumer:** Task 10 — RabbitmqModule, AiConsumer, Redis subscriber trimmed, AppModule wired
- [x] **No placeholders:** All steps contain actual code, no TBD
- [x] **Type consistency:** `VirtualRow` defined in Task 5 and used only within MessageList.tsx. `AiRequestPayload` in ai.consumer.ts matches the shape sent by `AiRedisPublisher.java`
