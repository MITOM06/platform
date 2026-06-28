# Plan: Conversation List 3-Tab Redesign

**Date:** 2026-06-28  
**Services:** chat-service (Java), web (Next.js), Flutter (client)  
**Sync rule:** Web + Flutter ship in same commit.

---

## Context & Current State

- **Conversation list sidebar** has only a search bar + flat list. No tabs.
- **Archived** is at `Settings → /archived` (separate page). User wants it as Tab 2 in the sidebar.
- **Blocked conversations** was added as a collapsible section in the sidebar (plan `2026-06-28-block-behavior-and-mute-duration.md` Task 12). User wants it moved to Settings instead.
- **Stranger DMs** (`status: 'pending'`, `createdBy !== currentUserId`) already exist in backend ✅ but are mixed into the main conversation list.
- **Group invitations**: currently when creator adds members to a group, all members join immediately (`STATUS_ACCEPTED`). There is no pending/acceptance flow for group invitations.
- `acceptConversation()` endpoint (`POST /api/conversations/{id}/accept`) already exists for DM requests.

## What changes

| Location | Before | After |
|---|---|---|
| Sidebar | Flat list + blocked collapsible | 3 tabs: Chat / Lưu trữ / Người lạ |
| Settings | Has "Lưu trữ" link | Replace with "Bị chặn" link → `/blocked` page |
| `/archived` page | Standalone page from Settings | Can stay as fallback; tab is primary |
| Blocked section | Collapsible in sidebar | Settings → `/blocked` page |
| Group invitation | Instant join | Added to `pendingMembers`, appears in "Người lạ" tab |

---

## PART A — Backend: Group Invitation Pending State

### Task 1 · chat-service — Add `pendingMembers` to `Conversation.java`

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/model/Conversation.java`

```java
/**
 * Group members who were invited but have not yet accepted.
 * Empty for DMs (which use the top-level {@code status} field instead).
 */
@Builder.Default private List<String> pendingMembers = new ArrayList<>();
```

---

### Task 2 · chat-service — Set `pendingMembers` when creating a group

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/ConversationService.java`

In `createGroup()`, update the `Conversation.builder()` call:

```java
// Invited members (everyone except the creator) start in pending state.
List<String> pendingMembers = new ArrayList<>(members);
pendingMembers.remove(creatorId);

Conversation saved = conversationCacheService.save(
    Conversation.builder()
        .type(Conversation.TYPE_GROUP)
        .name(request.name().trim())
        .avatarUrl(request.avatarUrl())
        .participants(new ArrayList<>(members))
        .admins(new ArrayList<>(List.of(creatorId)))
        .createdBy(creatorId)
        .departmentId(request.departmentId())
        .lastMessageAt(Instant.now())
        .pendingMembers(pendingMembers)   // <— add this
        .build());
```

---

### Task 3 · chat-service — Set `pendingMembers` when adding members to existing group

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/ConversationService.java`

In `addMembers()`, after adding to `participants`, also add to `pendingMembers`:

```java
// After: conversation.getParticipants().addAll(newUserIds)
// Add:
if (conversation.getPendingMembers() == null) conversation.setPendingMembers(new ArrayList<>());
for (String newId : newUserIds) {
  if (!conversation.getPendingMembers().contains(newId)) {
    conversation.getPendingMembers().add(newId);
  }
}
```

---

### Task 4 · chat-service — Update `acceptConversation()` to handle groups

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/ConversationService.java`

Replace the existing `acceptConversation()`:

```java
public ConversationResponse acceptConversation(String userId, String conversationId) {
  Conversation conversation = getRawConversation(userId, conversationId);

  if (Conversation.TYPE_DIRECT.equals(conversation.getType())) {
    // DM stranger request — existing logic
    if (userId.equals(conversation.getCreatedBy())) {
      throw new ForbiddenException("The initiator cannot accept their own request");
    }
    conversation.setStatus(Conversation.STATUS_ACCEPTED);
  } else {
    // Group invitation — remove from pendingMembers
    if (conversation.getPendingMembers() != null) {
      conversation.getPendingMembers().remove(userId);
    }
  }

  Conversation saved = conversationCacheService.save(conversation);
  return toResponse(saved, userId, messageRepository.countUnread(conversationId, userId));
}
```

---

### Task 5 · chat-service — Add `pendingMembers` to `ConversationResponse`

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/dto/ConversationResponse.java`

Add field to the record alongside `isBlocked`:

```java
List<String> pendingMembers,
```

Populate in the response builder:

```java
.pendingMembers(conv.getPendingMembers() != null ? conv.getPendingMembers() : List.of())
```

---

### Task 6 · chat-service — Include pending group conversations in `listConversations`

File: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/ConversationService.java`

Currently `listConversations` only returns conversations where `userId` is in `participants`. This already includes pending groups (the user is a participant). The web will filter them into the correct tab based on `pendingMembers`. **No backend change needed here** — the existing query returns everything and the web filters.

However, ensure the existing filter does NOT exclude conversations where `pendingMembers.contains(userId)` — i.e., invited members should still receive the conversation in the list response. Verify the existing filter does not exclude them.

---

## PART B — Web: 3-Tab Bar in Sidebar

### Task 7 · Web — Add tab types to `Conversation` and hooks

File: `apps/web/lib/api/types.ts`

```ts
// Add alongside existing fields:
pendingMembers?: string[]
```

File: `apps/web/lib/hooks/use-conversations.ts`

Add a `useRequestConversations` hook (for Tab 3):

```ts
export function useRequestConversations() {
  // Requests = pending DMs (not initiated by me) + groups where I'm in pendingMembers
  // These come from the same getConversations() call — filter on client
  return useQuery({
    queryKey: ['conversations'],            // same cache as main list
    queryFn: () => chatService.getConversations(),
    staleTime: 2 * 60 * 1000,
    select: (data) => data.content,         // filtering is done in ConversationList
  })
}
```

No new API call needed — all tabs draw from the same `['conversations']` query cache. Filtering by tab happens in the component.

---

### Task 8 · Web — Rewrite `ConversationList.tsx` with 3 tabs

File: `apps/web/components/chat/ConversationList.tsx`

Replace the current flat list with a tabbed layout. Use Tabs from `shadcn/ui`:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MessageSquare, Archive, UserX } from 'lucide-react'
```

Structure:

```tsx
<div className="flex flex-col h-full">
  {/* Search bar — unchanged */}
  <div className="px-3 py-2 shrink-0">
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input placeholder={t('searchPlaceholder')} ... />
    </div>
  </div>

  <OfflineBanner />

  {/* 3-tab bar */}
  <Tabs defaultValue="chats" className="flex flex-col flex-1 min-h-0">
    <TabsList className="mx-3 mb-1 grid grid-cols-3 h-8 shrink-0">
      <TabsTrigger value="chats" className="text-xs gap-1">
        <MessageSquare className="size-3" />
        {t('tabChats')}
      </TabsTrigger>
      <TabsTrigger value="archived" className="text-xs gap-1">
        <Archive className="size-3" />
        {t('tabArchived')}
      </TabsTrigger>
      <TabsTrigger value="requests" className="text-xs gap-1 relative">
        <UserX className="size-3" />
        {t('tabRequests')}
        {requestCount > 0 && (
          <span className="absolute -top-1 -right-1 size-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
            {requestCount > 9 ? '9+' : requestCount}
          </span>
        )}
      </TabsTrigger>
    </TabsList>

    {/* Tab 1: Regular chats */}
    <TabsContent value="chats" className="flex-1 overflow-y-auto px-2 pb-2 mt-0">
      {/* Show conversations where status=accepted, not archived, not blocked,
          not in pendingMembers */}
      {chatsFiltered.map((conv) => (
        <ConversationItem key={conv.id} conversation={conv} />
      ))}
      {/* Empty state */}
    </TabsContent>

    {/* Tab 2: Archived */}
    <TabsContent value="archived" className="flex-1 overflow-y-auto px-2 pb-2 mt-0">
      <ArchivedConversationList />   {/* extract from /archived page (see Task 9) */}
    </TabsContent>

    {/* Tab 3: Requests (strangers + group invitations) */}
    <TabsContent value="requests" className="flex-1 overflow-y-auto px-2 pb-2 mt-0">
      {requestsFiltered.map((conv) => (
        <ConversationRequestItem key={conv.id} conversation={conv} />
      ))}
      {/* Empty state */}
    </TabsContent>
  </Tabs>
</div>
```

**Filtering logic** (add above the return, after loading conversations):

```ts
const currentUserId = useAuthStore((s) => s.user?.id)

// Tab 1: accepted, not archived, not blocked, not pending group member
const chatsFiltered = conversations?.filter((conv) => {
  if (conv.isArchived || conv.isBlocked) return false
  if (conv.status === 'pending' && conv.createdBy !== currentUserId) return false
  if (conv.pendingMembers?.includes(currentUserId ?? '')) return false
  if (!search) return true
  return resolveSearchTerms(conv).some((t) => t.toLowerCase().includes(search.toLowerCase()))
}) ?? []

// Tab 3: pending DM (not initiated by me) OR group where I'm in pendingMembers
const requestsFiltered = conversations?.filter((conv) => {
  const isPendingDm = conv.type === 'direct' && conv.status === 'pending' && conv.createdBy !== currentUserId
  const isPendingGroup = !!conv.pendingMembers?.includes(currentUserId ?? '')
  return isPendingDm || isPendingGroup
}) ?? []

const requestCount = requestsFiltered.length
```

**Remove** the blocked collapsible section that was added by the previous plan (Tasks 11–12 of `2026-06-28-block-behavior-and-mute-duration.md`) — blocked conversations now live in Settings.

---

### Task 9 · Web — Extract `ArchivedConversationList` component

Create `apps/web/components/chat/ArchivedConversationList.tsx`:

Extract the list rendering from `apps/web/app/(main)/archived/page.tsx` into a reusable component that can be used both in the tab and the standalone page. The standalone `/archived` page becomes a wrapper around this component (keep it for direct navigation, but the primary entry point is now the tab).

The component:
- Fetches `chatService.getConversations(true)` (archived=true) via TanStack Query
- Renders `ConversationItem` for each archived conversation
- Shows unarchive option in context menu (already exists)
- Shows empty state when no archived conversations

---

### Task 10 · Web — Create `ConversationRequestItem` component

Create `apps/web/components/chat/ConversationRequestItem.tsx`:

This item renders differently from a normal `ConversationItem` — it shows:
- Conversation avatar + name (group) or sender name/avatar (DM)
- Preview of the first message
- Two action buttons: **"Chấp nhận"** (Accept) and **"Từ chối"** (Decline)
- For DM requests: subtitle "Muốn nhắn tin với bạn"
- For group invitations: subtitle "Đã mời bạn vào nhóm · [creator name]"

```tsx
function ConversationRequestItem({ conversation }: { conversation: Conversation }) {
  const isGroupInvite = !!conversation.pendingMembers?.includes(currentUserId)
  const isDmRequest = conversation.type === 'direct' && conversation.status === 'pending'

  const handleAccept = async () => {
    await chatService.acceptConversation(conversation.id)
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }

  const handleDecline = async () => {
    if (isGroupInvite) {
      // Leave the group
      await chatService.leaveConversation(conversation.id)
    } else {
      // Delete the DM request
      await chatService.deleteConversation(conversation.id)
    }
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }

  return (
    <div className="flex items-start gap-3 px-2 py-3 rounded-lg hover:bg-muted/50">
      <Avatar ... />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground truncate">
          {isGroupInvite ? t('groupInviteSubtitle', { creator: creatorName }) : t('dmRequestSubtitle')}
        </p>
        {/* Message preview */}
        <p className="text-xs text-muted-foreground truncate mt-0.5">{lastMessagePreview}</p>
        {/* Action buttons */}
        <div className="flex gap-2 mt-2">
          <Button size="sm" className="h-7 text-xs" onClick={handleAccept}>
            {t('acceptRequest')}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleDecline}>
            {t('declineRequest')}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

Add `acceptConversation` and `leaveConversation` to `chat.ts` if not already there:

```ts
acceptConversation: (id: string) =>
  chatApi.post<Conversation>(`/api/conversations/${id}/accept`).then((r) => r.data),

leaveConversation: (id: string) =>
  chatApi.delete(`/api/conversations/${id}/members/${currentUserId}`),
  // OR: chatApi.post(`/api/conversations/${id}/leave`) if a dedicated endpoint exists
```

---

### Task 11 · Web — Update Settings page

File: `apps/web/app/(main)/settings/page.tsx`

1. **Remove** the "Lưu trữ" (`/archived`) settings item.
2. **Add** "Tin nhắn bị chặn" item in its place:

```tsx
// Replace archived item with:
<SettingsItem
  icon={<Ban className="size-5 text-primary" />}
  title={t('blockedChats')}
  subtitle={t('blockedChatsSubtitle')}
  onClick={() => router.push('/blocked')}
/>
```

---

### Task 12 · Web — Create `/blocked` page (Settings → Blocked)

Create `apps/web/app/(main)/blocked/page.tsx`:

Same structure as the existing `/archived` page but:
- Fetches `chatService.getBlockedConversations()` (uses `?blocked=true`)
- Shows blocked conversations
- Each item has "Bỏ chặn" (Unblock) action: calls `unblockUser(otherUserId)` + `blockRestoreConversation(convId)`
- Empty state: "Không có cuộc trò chuyện nào bị chặn"

This is the new home for the blocked section (moved from sidebar collapsible).

---

### Task 13 · Web — i18n keys

Files: `apps/web/messages/*.json`

```json
"tabChats":             "Đoạn chat",
"tabArchived":          "Lưu trữ",
"tabRequests":          "Người lạ",
"dmRequestSubtitle":    "Muốn nhắn tin với bạn",
"groupInviteSubtitle":  "Đã mời bạn vào nhóm",
"acceptRequest":        "Chấp nhận",
"declineRequest":       "Từ chối",
"blockedChats":         "Tin nhắn bị chặn",
"blockedChatsSubtitle": "Quản lý các cuộc trò chuyện đã chặn"
```

(English: `"Chats"` / `"Archived"` / `"Requests"` / `"Wants to message you"` / `"Invited you to a group"` / `"Accept"` / `"Decline"` / `"Blocked chats"` / `"Manage blocked conversations"`)

---

## PART C — Flutter Mirror

### Task 14 · Flutter — Update conversation model

File: `apps/client/lib/models/conversation.dart`

```dart
final List<String> pendingMembers;

// In fromJson:
pendingMembers: List<String>.from(json['pendingMembers'] ?? []),
```

---

### Task 15 · Flutter — Add 3-tab bar to `conversation_list_screen.dart`

File: `apps/client/lib/features/chat/ui/conversation_list_screen.dart`

Replace the current flat list with a `DefaultTabController` + `TabBar` + `TabBarView`:

```dart
DefaultTabController(
  length: 3,
  child: Column(
    children: [
      // Existing search bar (unchanged)
      _buildSearchBar(),

      // Tab bar
      TabBar(
        tabs: [
          Tab(text: l10n.tabChats,    icon: Icon(Icons.chat_bubble_outline, size: 16)),
          Tab(text: l10n.tabArchived, icon: Icon(Icons.archive_outlined,    size: 16)),
          Tab(text: l10n.tabRequests, icon: _RequestsTabIcon(count: requestCount)),
        ],
        labelStyle: TextStyle(fontSize: 12),
        indicatorSize: TabBarIndicatorSize.tab,
      ),

      // Tab content
      Expanded(
        child: TabBarView(
          children: [
            _ChatsTab(),         // Task 16
            _ArchivedTab(),      // Task 17
            _RequestsTab(),      // Task 18
          ],
        ),
      ),
    ],
  ),
)
```

---

### Task 16 · Flutter — `_ChatsTab` widget

Filter logic (same as web):
- `status == 'accepted'`
- `!isArchived`
- `!isBlocked`
- `!pendingMembers.contains(currentUserId)`

Renders the existing `ConversationTile` for each.

---

### Task 17 · Flutter — `_ArchivedTab` widget

Fetches archived conversations (previously in Settings → archived page):
- Calls `chatService.getArchivedConversations()` which hits `GET /api/conversations?archived=true`
- Renders `ConversationTile` with unarchive option
- Empty state widget

Remove the "Lưu trữ" entry from Flutter Settings screen.

---

### Task 18 · Flutter — `_RequestsTab` widget

Filter from conversations:
```dart
final requests = allConversations.where((conv) {
  final isPendingDm = conv.type == 'direct' 
      && conv.status == 'pending' 
      && conv.createdBy != currentUserId;
  final isPendingGroup = conv.pendingMembers.contains(currentUserId);
  return isPendingDm || isPendingGroup;
}).toList();
```

For each request, render a `ConversationRequestTile`:
- Shows avatar + name + subtitle
  - DM: "Muốn nhắn tin với bạn"
  - Group: "Đã mời bạn vào nhóm"
- Two buttons: "Chấp nhận" / "Từ chối"
  - Accept: `chatService.acceptConversation(conv.id)` → refresh conversations
  - Decline DM: `chatService.deleteConversation(conv.id)`
  - Decline group: leave the group (`chatService.leaveConversation(conv.id, currentUserId)`)

Badge on tab: shows request count > 0.

---

### Task 19 · Flutter — Update Settings screen

Remove "Lưu trữ" entry from Flutter Settings.

Add "Tin nhắn bị chặn" entry → navigates to a new `BlockedConversationsScreen` (mirrors web `/blocked` page):
- Lists blocked conversations via `chatService.getBlockedConversations()`
- Each item has "Bỏ chặn" action

---

### Task 20 · Flutter — i18n

File: `apps/client/lib/l10n/app_localizations_vi.arb` and other locales

```arb
"tabChats":             "Đoạn chat",
"tabArchived":          "Lưu trữ",
"tabRequests":          "Người lạ",
"dmRequestSubtitle":    "Muốn nhắn tin với bạn",
"groupInviteSubtitle":  "Đã mời bạn vào nhóm",
"acceptRequest":        "Chấp nhận",
"declineRequest":       "Từ chối",
"blockedChatsTitle":    "Tin nhắn bị chặn"
```

---

## Verify Checklist (Task 21)

**Web:**
- [ ] Sidebar shows 3 tabs: Đoạn chat / Lưu trữ / Người lạ
- [ ] Tab 1 does NOT show archived, blocked, pending-group-invitation, or pending-DM-from-stranger conversations
- [ ] Tab 2 shows archived conversations (same content as old `/archived` page)
- [ ] Tab 3 shows stranger DM requests with Accept/Decline buttons
- [ ] Tab 3 shows group invitation requests with Accept/Decline buttons
- [ ] Accepting a DM request → conversation moves to Tab 1
- [ ] Accepting a group invitation → group appears in Tab 1
- [ ] Declining a DM request → conversation disappears from all tabs
- [ ] Declining a group invitation → user leaves the group
- [ ] Tab 3 badge shows count of pending requests
- [ ] Settings no longer has "Lưu trữ" item
- [ ] Settings has "Tin nhắn bị chặn" item → opens `/blocked` page
- [ ] `/blocked` page lists blocked conversations with Unblock action

**chat-service:**
- [ ] Creating a group with members → members appear in `pendingMembers`, creator does not
- [ ] `POST /api/conversations/{id}/accept` for a group removes userId from `pendingMembers`
- [ ] `POST /api/conversations/{id}/accept` for a DM sets `status = 'accepted'`
- [ ] `GET /api/conversations` response includes `pendingMembers` field

**Flutter:**
- [ ] All of the above mirrored
- [ ] Settings removed archived entry, added blocked entry
