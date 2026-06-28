# Plan: Block Behavior + Mute Duration

**Date:** 2026-06-28  
**Services:** chat-service (Java), auth-service (NestJS), web (Next.js), Flutter (client)  
**Sync rule:** Web + Flutter ship in same commit.

---

## Context & Current State

**Block system (existing):**
- `UserBlock` collection in MongoDB, owned by auth-service
- `UserBlockRepository.java` in chat-service reads it directly (shared MongoDB) — no HTTP needed
- `MessageService.sendMessage()` already rejects messages if a block exists (`helper.isBlockedBetween()`) ✅
- `BlockedComposerNotice.tsx` shows in the composer area when `iBlocked` or `blockedMe` is true ✅
- **NOT done:** moving conversation to a "Blocked" section, profile privacy, online status hiding, call blocking
- **Bug:** `chatService.blockUser/unblockUser` in `apps/web/lib/api/chat.ts` uses `chatApi` but the endpoint lives in auth-service — must be changed to `authApi`

**Mute system (existing):**
- `mutedUsers: List<String>` in `Conversation.java` — boolean mute, no expiry
- `muteConversation()` / `unmuteConversation()` / `isMuted()` — simple list add/remove
- `isMuted: boolean` in `ConversationResponse` and web `Conversation` type
- FCM push notifications already skip muted conversations ✅
- **NOT done:** time-based muting (15min / 30min / 1h / 24h / until manual)

---

## PART A — Block Behavior

### Task 1 · chat-service — Add `blockedBy` field to `Conversation.java`

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/model/Conversation.java`

After the `archivedBy` field (currently line 103):

```java
/** Users for whom this conversation is in the "Blocked" section (blocker side only). */
@Builder.Default private List<String> blockedBy = new ArrayList<>();
```

---

### Task 2 · chat-service — Add `isBlocked` to `ConversationResponse`

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/dto/ConversationResponse.java`

Add field alongside `isMuted` and `isArchived`:

```java
boolean isBlocked,
```

In the builder/factory method where `ConversationResponse` is constructed (the `toResponse(userId, conv)` or equivalent), set:

```java
.isBlocked(conv.getBlockedBy() != null && conv.getBlockedBy().contains(userId))
```

---

### Task 3 · chat-service — Update `listConversations` to exclude blocked conversations

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/ConversationService.java`

In `listConversations(String userId, Pageable pageable, boolean archived)`, in the stream filter, add a blocked exclusion:

```java
// Before:
return archived == isArchived;

// After:
boolean isBlockedForUser = c.getBlockedBy() != null && c.getBlockedBy().contains(userId);
if (isBlockedForUser) return false; // always exclude from normal + archived lists
return archived == isArchived;
```

---

### Task 4 · chat-service — Add `listBlockedConversations`, `blockArchive`, `blockRestore` to `ConversationService`

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/ConversationService.java`

Add three methods (model the pagination logic after the existing `listConversations`):

```java
/** Returns conversations the user has moved to the Blocked section. */
public PageResponse<ConversationResponse> listBlockedConversations(String userId, Pageable pageable) {
  // Same stream + pagination pattern as listConversations; filter = blockedBy.contains(userId)
  List<Conversation> all = conversationRepository.findAll().stream()
      .filter(c -> c.getParticipants().contains(userId)
               && c.getBlockedBy() != null
               && c.getBlockedBy().contains(userId))
      .sorted(Comparator.comparing(Conversation::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
      .collect(Collectors.toList());
  int start  = (int) pageable.getOffset();
  int end    = Math.min(start + pageable.getPageSize(), all.size());
  List<ConversationResponse> page = all.subList(start, end).stream()
      .map(c -> toResponse(userId, c))
      .collect(Collectors.toList());
  return new PageResponse<>(page, all.size(), pageable.getPageNumber(), pageable.getPageSize());
}

/** Move conversation to the Blocked section for userId (called after blockUser). */
public ConversationResponse blockArchiveConversation(String userId, String conversationId) {
  Conversation conv = requireParticipant(userId, conversationId);
  if (conv.getBlockedBy() == null) conv.setBlockedBy(new ArrayList<>());
  if (!conv.getBlockedBy().contains(userId)) {
    conv.getBlockedBy().add(userId);
    conversationRepository.save(conv);
  }
  return toResponse(userId, conv);
}

/** Restore conversation from Blocked section (called after unblockUser). */
public ConversationResponse blockRestoreConversation(String userId, String conversationId) {
  Conversation conv = requireParticipant(userId, conversationId);
  if (conv.getBlockedBy() != null && conv.getBlockedBy().remove(userId)) {
    conversationRepository.save(conv);
  }
  return toResponse(userId, conv);
}
```

`requireParticipant` is an internal helper that `findById` + checks `participants.contains(userId)` + throws `ForbiddenException` if not — add it or reuse an equivalent that already exists.

---

### Task 5 · chat-service — Add blocked endpoints to `ConversationController`

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/ConversationController.java`

1. Update existing `@GetMapping` to accept `blocked` param:

```java
@GetMapping
public PageResponse<ConversationResponse> listConversations(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size,
    @RequestParam(defaultValue = "false") boolean archived,
    @RequestParam(defaultValue = "false") boolean blocked) {
  Pageable pageable = PageRequest.of(page, size);
  if (blocked) {
    return conversationService.listBlockedConversations(currentUserId(), pageable);
  }
  return conversationService.listConversations(currentUserId(), pageable, archived);
}
```

2. Add two new endpoints:

```java
@PostMapping("/{id}/block-archive")
public ConversationResponse blockArchive(@PathVariable String id) {
  ConversationResponse updated = conversationService.blockArchiveConversation(currentUserId(), id);
  broadcastConversationUpdated(updated);
  return updated;
}

@PostMapping("/{id}/block-restore")
public ConversationResponse blockRestore(@PathVariable String id) {
  ConversationResponse updated = conversationService.blockRestoreConversation(currentUserId(), id);
  broadcastConversationUpdated(updated);
  return updated;
}
```

---

### Task 6 · chat-service — Block check in `CallService.startCall()`

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/CallService.java`

Inject `UserBlockRepository userBlockRepository` (it is already used in `MessageServiceHelper` — same pattern).

In `startCall()`, after the null check for `conversationId`, before saving `CallSession`:

```java
// Block guard: for DM conversations, reject call if other participant has blocked the caller
Conversation conv = conversationRepository.findById(conversationId).orElse(null);
if (conv != null && conv.getParticipants().size() == 2) {
  for (String p : conv.getParticipants()) {
    if (!p.equals(userId) && userBlockRepository.existsByBlockerIdAndBlockedId(p, userId)) {
      // Notify the caller only — do not create a CallSession
      WebRTCSignalDto blocked = WebRTCSignalDto.builder()
          .type("call-blocked")
          .conversationId(conversationId)
          .senderId(userId)
          .build();
      clusterBroker.convertAndSendToUser(userId, WEBRTC_QUEUE, blocked);
      return;
    }
  }
}
```

`conversationRepository` and `WEBRTC_QUEUE` are already used elsewhere in `CallService` — no new injections needed except `userBlockRepository`.

---

### Task 7 · auth-service — Profile privacy for blocked users

File: `apps/server/auth-service/src/modules/users/users.service.ts`

Add:

```ts
/** Returns true if ownerId has blocked callerId. */
async isBlockedBy(ownerId: string, callerId: string): Promise<boolean> {
  const exists = await this.userBlockModel.exists({
    blockerId: ownerId,
    blockedId: callerId,
  });
  return !!exists;
}
```

File: `apps/server/auth-service/src/modules/users/users.controller.ts`

Update `findById()`:

```ts
@Get(':id')
async findById(@Req() req: any, @Param('id') id: string) {
  const user = await this.usersService.findById(id);
  if (!user) return user;
  const [friendsCount, isBlockedByOwner] = await Promise.all([
    this.friendsService.countAccepted(id),
    this.usersService.isBlockedBy(id, req.user.sub),
  ]);
  return this.toProfile(user.toObject(), req.user.sub, friendsCount, isBlockedByOwner);
}
```

Update `toProfile()` signature and add early-return:

```ts
private toProfile(
  doc: any,
  callerId: string,
  friendsCount: number,
  isBlockedByOwner = false,
): any {
  const isSelf = callerId === String(doc._id);

  // Caller is blocked by the profile owner → return minimal public info only
  if (!isSelf && isBlockedByOwner) {
    return {
      _id: doc._id,
      id: doc._id,
      displayName: doc.displayName,
      avatarUrl: doc.avatarUrl ?? '',
      coverPhoto: doc.coverPhoto ?? '',
      email: doc.email,           // email stays visible per product spec
      isVerified: doc.isVerified ?? false,
      friendsCount: 0,
      bio: '',
      isBlockedByOwner: true,     // tells client to hide action buttons
    };
  }

  // ... rest of existing toProfile logic unchanged ...
}
```

Note: `findManyByIds` (batch endpoint) is used for participant profile fetching in conversation lists — do NOT add block filtering there (it would break conversation rendering). The block profile restriction applies only to the single `GET /api/users/:id` view.

---

### Task 8 · auth-service — Online status hiding for blocked users

File: `apps/server/auth-service/src/modules/friends/friends.service.ts`

The `userBlockModel` is not currently injected in `FriendsService`. Inject it:

```ts
// In constructor:
@InjectModel(UserBlock.name) private readonly userBlockModel: Model<UserBlockDocument>,
```

Update `listOnlineFriends()` to filter out blocked relationships:

```ts
async listOnlineFriends(userId: string): Promise<UserDocument[]> {
  // ... existing code to get friends list and check Redis statuses ...
  const onlineFriends = friends.filter((_, i) => statuses[i] === 'online');

  // Exclude anyone who has blocked userId OR been blocked by userId
  if (onlineFriends.length === 0) return [];
  const friendIds = onlineFriends.map((f) => String(f._id));
  const blocks = await this.userBlockModel.find({
    $or: [
      { blockerId: userId, blockedId: { $in: friendIds } },
      { blockerId: { $in: friendIds }, blockedId: userId },
    ],
  });
  const blockedSet = new Set<string>();
  for (const b of blocks) {
    blockedSet.add(b.blockerId === userId ? b.blockedId : b.blockerId);
  }

  return onlineFriends.filter((f) => !blockedSet.has(String(f._id)));
}
```

`FriendsModule` already imports `UsersModule` (or has access to MongoDB) — add `UserBlock` model import as needed, same pattern as how `UsersService` imports it.

---

### Task 9 · Web — Fix `blockUser/unblockUser` API call + add new methods

File: `apps/web/lib/api/chat.ts`

1. **Fix the API instance bug** — `blockUser/unblockUser` currently use `chatApi` (chat-service) but the endpoint is in auth-service. Change to `authApi`:

```ts
import { chatApi, authApi } from './axios'

// Replace existing:
blockUser: (userId: string) =>
  authApi.post(`/api/users/block/${userId}`),

unblockUser: (userId: string) =>
  authApi.post(`/api/users/unblock/${userId}`),
```

2. **Add new methods:**

```ts
getBlockedConversations: () =>
  chatApi
    .get<ConversationsResponse>('/api/conversations', { params: { blocked: true } })
    .then((r) => r.data),

blockArchiveConversation: (id: string) =>
  chatApi.post<Conversation>(`/api/conversations/${id}/block-archive`).then((r) => r.data),

blockRestoreConversation: (id: string) =>
  chatApi.post<Conversation>(`/api/conversations/${id}/block-restore`).then((r) => r.data),
```

---

### Task 10 · Web — Update `Conversation` type

File: `apps/web/lib/api/types.ts`

Add alongside `isMuted` and `isArchived`:

```ts
isBlocked?: boolean
```

---

### Task 11 · Web — Block action triggers both user block + conversation move

File: `apps/web/components/chat/ConversationItem.tsx` (or `ConversationSettingsDrawer.tsx`, wherever the block onClick is)

Update the block handler:

```ts
// Block:
const handleBlock = async () => {
  await chatService.blockUser(otherUserId)
  await chatService.blockArchiveConversation(conversation.id)
  queryClient.invalidateQueries({ queryKey: ['conversations'] })
  queryClient.invalidateQueries({ queryKey: ['blocked-conversations'] })
  toast.success(t('userBlocked'))
}

// Unblock (from blocked section — see Task 12):
const handleUnblock = async () => {
  await chatService.unblockUser(otherUserId)
  await chatService.blockRestoreConversation(conversation.id)
  queryClient.invalidateQueries({ queryKey: ['conversations'] })
  queryClient.invalidateQueries({ queryKey: ['blocked-conversations'] })
  toast.success(t('userUnblocked'))
}
```

---

### Task 12 · Web — "Blocked" section in `ConversationList.tsx`

File: `apps/web/components/chat/ConversationList.tsx`

1. Add hook `useBlockedConversations` (same pattern as `useConversations` but calls `getBlockedConversations()`).

2. Add a collapsible "Blocked" section below the archived section toggle. Only render it when there is at least one blocked conversation:

```tsx
{blockedCount > 0 && (
  <div>
    <button
      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
      onClick={() => setShowBlocked((v) => !v)}
    >
      <Ban className="size-3" />
      {t('blockedChats')} ({blockedCount})
      <ChevronDown className={cn('size-3 ml-auto transition-transform', showBlocked && 'rotate-180')} />
    </button>
    {showBlocked && blockedConversations?.map((conv) => (
      <ConversationItem
        key={conv.id}
        conversation={conv}
        isBlocked={true}     // tells ConversationItem to show Unblock instead of Block
      />
    ))}
  </div>
)}
```

3. In `ConversationItem.tsx`, when `isBlocked` prop is true:
   - Show "Unblock" action in context menu (calls `handleUnblock`)
   - Hide the normal "Block" action
   - Show a 🚫 indicator in the conversation row (small icon, like the 🔇 mute indicator)

---

### Task 13 · Web — Handle `call-blocked` STOMP event

File: wherever STOMP/WebRTC events are handled (likely `apps/web/hooks/use-webrtc.ts` or `apps/web/components/chat/CallModal.tsx`)

Look for the section that dispatches on `signal.type`. Add:

```ts
case 'call-blocked':
  // The person we tried to call has us blocked
  toast.error(t('callBlocked'))
  // Also close any call UI that opened
  dispatch(closeCall?.()) // or however the call UI state is cleared
  break
```

i18n key `callBlocked` = `"Người dùng này không muốn được liên lạc"`.

---

### Task 14 · Web — i18n keys (all locale files)

Files: `apps/web/messages/*.json`

Add:

```json
"blockedChats": "Bị chặn",
"noBlockedChats": "Không có cuộc trò chuyện bị chặn",
"callBlocked": "Người dùng này không muốn được liên lạc",
"blockAndHide": "Chặn",
"unblockAndRestore": "Bỏ chặn"
```

(All other language files: English = "Blocked" / "No blocked conversations" / "This user doesn't want to be contacted" / "Block" / "Unblock")

---

### Task 15 · Flutter — Mirror block behavior

File: `apps/client/lib/services/chat_service.dart` (or equivalent)

Add methods:
- `getBlockedConversations()` → `GET /api/conversations?blocked=true`
- `blockArchiveConversation(convId)` → `POST /api/conversations/{convId}/block-archive`
- `blockRestoreConversation(convId)` → `POST /api/conversations/{convId}/block-restore`

Also fix any `blockUser/unblockUser` calls to hit auth-service base URL (not chat-service).

File: `apps/client/lib/features/chat/ui/conversation_list_screen.dart`

Add a "Blocked" expandable section using the same `ConversationListScreen` structure, following the pattern of how archived conversations are shown.

File: `apps/client/lib/models/conversation.dart`

Add `isBlocked: bool` field with `fromJson` parsing.

File: `apps/client/lib/features/chat/ui/widgets/conversation_tile_menu.dart`

- When `conversation.isBlocked`: show "Unblock" option → calls `blockRestoreConversation` + `unblockUser`
- When not blocked: show "Block" option → calls `blockUser` + `blockArchiveConversation`

Handle `call-blocked` STOMP/signal event: show Snackbar with localised "người dùng không muốn được liên lạc" text.

Profile screen: check `isBlockedByOwner: true` in the profile response → hide bio, friend count, action buttons (message / call / add friend); show only avatar, cover photo, email.

---

## PART B — Mute Duration

### Task 16 · chat-service — Replace `mutedUsers` with `mutedUntil` in `Conversation.java`

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/model/Conversation.java`

```java
// Remove:
@Builder.Default private List<String> mutedUsers = new ArrayList<>();

// Add:
/**
 * userId → epoch-millisecond expiry.
 * Long.MAX_VALUE means "muted until the user manually unmutes".
 * Missing key or expired value = not muted.
 */
@Builder.Default private Map<String, Long> mutedUntil = new HashMap<>();
```

Import: `java.util.HashMap`, `java.util.Map`.

---

### Task 17 · chat-service — Update mute methods in `ConversationService.java`

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/ConversationService.java`

Replace the existing `muteConversation`, `unmuteConversation`, and `isMuted` implementations:

```java
/**
 * Mute conversation for userId.
 * @param durationSeconds 900=15min, 1800=30min, 3600=1h, 86400=24h, -1=forever
 */
public ConversationResponse muteConversation(String userId, String conversationId, long durationSeconds) {
  Conversation conv = findConversationForUser(userId, conversationId);
  if (conv.getMutedUntil() == null) conv.setMutedUntil(new HashMap<>());
  long expiryMs = (durationSeconds <= 0)
      ? Long.MAX_VALUE
      : System.currentTimeMillis() + durationSeconds * 1000L;
  conv.getMutedUntil().put(userId, expiryMs);
  conversationRepository.save(conv);
  return toResponse(userId, conv);
}

public ConversationResponse unmuteConversation(String userId, String conversationId) {
  Conversation conv = findConversationForUser(userId, conversationId);
  if (conv.getMutedUntil() != null) {
    conv.getMutedUntil().remove(userId);
    conversationRepository.save(conv);
  }
  return toResponse(userId, conv);
}

public boolean isMuted(String conversationId, String userId) {
  Conversation conv = conversationRepository.findById(conversationId).orElse(null);
  if (conv == null || conv.getMutedUntil() == null) return false;
  Long until = conv.getMutedUntil().get(userId);
  return until != null && until > System.currentTimeMillis();
}
```

Note: if there is an internal helper / inline call to the old `isMuted(conv, userId)` that accepts a `Conversation` directly (avoiding a repo lookup), update it the same way: `conv.getMutedUntil().get(userId) > System.currentTimeMillis()`.

---

### Task 18 · chat-service — Update `ConversationController` mute endpoint

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/ConversationController.java`

Add request record (inside the file or as a separate file in `dto/`):

```java
record MuteDurationRequest(Long durationSeconds) {}
```

Replace existing `@PostMapping("/{id}/mute")`:

```java
@PostMapping("/{id}/mute")
public ConversationResponse muteConversation(
    @PathVariable String id,
    @RequestBody(required = false) MuteDurationRequest body) {
  long seconds = (body == null || body.durationSeconds() == null) ? -1L : body.durationSeconds();
  ConversationResponse updated = conversationService.muteConversation(currentUserId(), id, seconds);
  broadcastConversationUpdated(updated);
  return updated;
}
```

`unmute` endpoint stays the same (no body needed).

---

### Task 19 · chat-service — Add `muteExpiresAt` to `ConversationResponse`

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/dto/ConversationResponse.java`

Add field:

```java
Long muteExpiresAt,   // epoch ms; null = not muted; Long.MAX_VALUE = muted forever
```

In the response builder:

```java
.isMuted(isMutedNow)
.muteExpiresAt(isMutedNow ? conv.getMutedUntil().get(userId) : null)
```

where `isMutedNow` = `until != null && until > System.currentTimeMillis()`.

---

### Task 20 · Web — Update `Conversation` type + `chatService.muteConversation`

File: `apps/web/lib/api/types.ts`

```ts
// Existing:
isMuted: boolean
// Add:
muteExpiresAt?: number | null    // epoch ms; Long.MAX_VALUE (~9.2e18) = muted forever
```

File: `apps/web/lib/api/chat.ts`

Update `muteConversation` to send duration:

```ts
muteConversation: (id: string, durationSeconds: number) =>
  chatApi
    .post<Conversation>(`/api/conversations/${id}/mute`, { durationSeconds })
    .then((r) => r.data),
```

---

### Task 21 · Web — Mute duration picker in context menu

File: `apps/web/components/chat/ConversationItem.tsx`

Add helper constants and function near the top of the file:

```ts
const MUTE_FOREVER_MS = 9_200_000_000_000_000 // close enough to Long.MAX_VALUE

function formatMuteExpiry(expiresAt: number): string {
  const remaining = expiresAt - Date.now()
  if (remaining <= 0) return ''
  const mins = Math.ceil(remaining / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(remaining / 3_600_000)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}
```

Replace the single mute toggle `DropdownMenuItem` with a sub-menu when not muted, and a regular item (with remaining time) when already muted:

```tsx
{conv.isMuted ? (
  <DropdownMenuItem onClick={handleUnmute}>
    <Volume2 className="size-4" />
    <span>{t('unmuteNotifications')}</span>
    {conv.muteExpiresAt && conv.muteExpiresAt < MUTE_FOREVER_MS && (
      <span className="ml-auto text-xs text-muted-foreground">
        {formatMuteExpiry(conv.muteExpiresAt)}
      </span>
    )}
  </DropdownMenuItem>
) : (
  <DropdownMenuSub>
    <DropdownMenuSubTrigger>
      <VolumeX className="size-4" />
      {t('muteNotifications')}
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent>
      {(
        [
          { labelKey: 'mute15min',   seconds: 900   },
          { labelKey: 'mute30min',   seconds: 1800  },
          { labelKey: 'mute1hour',   seconds: 3600  },
          { labelKey: 'mute24hours', seconds: 86400 },
          { labelKey: 'muteForever', seconds: -1    },
        ] as const
      ).map(({ labelKey, seconds }) => (
        <DropdownMenuItem
          key={seconds}
          onClick={() =>
            handleAction(
              () => chatService.muteConversation(conv.id, seconds),
              t('muteSuccess'),
            )
          }
        >
          {t(labelKey)}
        </DropdownMenuItem>
      ))}
    </DropdownMenuSubContent>
  </DropdownMenuSub>
)}
```

Also update the mute icon row in the conversation list item to show remaining time alongside 🔇:

```tsx
{conv.isMuted && (
  <span className="flex items-center gap-0.5 text-muted-foreground shrink-0">
    <VolumeX className="size-3" />
    {conv.muteExpiresAt && conv.muteExpiresAt < MUTE_FOREVER_MS && (
      <span className="text-xs">{formatMuteExpiry(conv.muteExpiresAt)}</span>
    )}
  </span>
)}
```

---

### Task 22 · Web — i18n keys for mute duration

Files: `apps/web/messages/*.json`

Add to every locale:

```json
"mute15min":   "15 phút",
"mute30min":   "30 phút",
"mute1hour":   "1 giờ",
"mute24hours": "24 giờ",
"muteForever": "Cho đến khi tôi bật lại"
```

(English: `"15 minutes"`, `"30 minutes"`, `"1 hour"`, `"24 hours"`, `"Until I turn back on"`)

---

### Task 23 · Flutter — Mirror mute duration

File: `apps/client/lib/models/conversation.dart`

Add:
```dart
final int? muteExpiresAt;   // epoch ms; null = not muted
```

File: `apps/client/lib/services/chat_service.dart`

Update `muteConversation`:
```dart
Future<Conversation> muteConversation(String convId, {required int durationSeconds}) async {
  final res = await _dio.post('/api/conversations/$convId/mute',
      data: {'durationSeconds': durationSeconds});
  return Conversation.fromJson(res.data);
}
```

File: `apps/client/lib/features/chat/ui/widgets/conversation_tile_menu.dart`

Replace mute toggle with a bottom sheet showing 5 options:

```dart
void _showMuteOptions(BuildContext context) {
  showModalBottomSheet(
    context: context,
    builder: (_) => Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ListTile(title: Text('15 phút'),    onTap: () => _mute(context, 900)),
        ListTile(title: Text('30 phút'),    onTap: () => _mute(context, 1800)),
        ListTile(title: Text('1 giờ'),      onTap: () => _mute(context, 3600)),
        ListTile(title: Text('24 giờ'),     onTap: () => _mute(context, 86400)),
        ListTile(title: Text('Cho đến khi tôi bật lại'), onTap: () => _mute(context, -1)),
      ],
    ),
  );
}
```

Show remaining time in `ConversationTile` alongside the mute icon when `muteExpiresAt` is set and not `Long.MAX_VALUE` (~9.2e18).

---

## Verify Checklist (Task 24)

**Web:**
- [ ] Block user from conversation menu → conversation disappears from main list
- [ ] "Blocked (N)" section appears in sidebar → conversation is listed there
- [ ] Unblock from Blocked section → conversation returns to main list
- [ ] Blocked user tries to call → caller sees error toast, no call starts
- [ ] View blocked user's profile → only avatar, cover, name, email visible; bio and buttons hidden
- [ ] Online friends list never includes users who have blocked you or been blocked by you
- [ ] Mute 15 min → 🔇 appears with "14m" countdown in conversation row
- [ ] Mute submenu shows all 5 options
- [ ] Mute forever → 🔇 with no countdown
- [ ] Unmute from context menu → 🔇 disappears
- [ ] After mute expiry, next poll returns `isMuted: false` (no client timer required)
- [ ] Sending message to conversation where other side blocked you → error (already works)

**Flutter:**
- [ ] All of the above mirrored

**chat-service unit tests** (if applicable):
- [ ] `isMuted()` returns false when `mutedUntil` has expired entry
- [ ] `listConversations()` excludes `blockedBy` conversations
- [ ] `startCall()` sends `call-blocked` signal and returns early when block exists
