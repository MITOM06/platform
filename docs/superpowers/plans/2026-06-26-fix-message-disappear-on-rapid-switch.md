# Fix: Messages Disappear on Rapid Conversation Switch

**Symptom:** Switching between conversations A→B→C 3-4 times quickly causes the message area
to go completely blank and never recover — requires a full page reload.

**Root causes:**

1. **STOMP subscription effect has too many dependencies** — `patchMessage`, `appendMessage`,
   `attachAiSources`, `markMessageRead` are all in the dep array. They're recreated on every
   `id` change, so the effect tears down and sets up the subscription multiple times per switch.
   Combined with `waitForConnect()` being async, rapid switches create windows where no
   subscription is active and incoming STOMP messages are permanently lost.

2. **`staleTime: 0` (default) triggers a refetch on every conversation switch** — 3-4 rapid
   switches = 3-4 simultaneous in-flight requests. If any fail, TanStack Query enters `isError`
   state with no cached data → blank screen.

**Fix strategy (how Messenger/Zalo do it):**
- STOMP subscription only re-runs when `id` or connection status changes — callbacks accessed
  via refs, not captured in the closure dep array.
- `staleTime: Infinity` — STOMP is the real-time source of truth; fetching on every switch is
  redundant and harmful. Initial load still fetches; subsequent visits use cache.
- `gcTime: 10 * 60 * 1000` — keep cache alive for 10 min across rapid switches.

All changes are in `apps/web` only. No backend changes.

---

## Task 1 — Fix `useMessages`: add staleTime + gcTime

**File:** `apps/web/lib/hooks/use-messages.ts`

Replace the `useInfiniteQuery` call to add cache lifetime settings:

```ts
import { useInfiniteQuery } from '@tanstack/react-query'
import { chatService } from '@/lib/api/chat'

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) =>
      chatService.getMessages(conversationId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasNext && lastPage.content.length > 0
        ? lastPage.content[lastPage.content.length - 1].id
        : undefined,
    enabled: !!conversationId,
    // STOMP keeps the cache up to date in real-time.
    // Never mark cached messages as stale — no background refetch on switch.
    staleTime: Infinity,
    // Keep the cache alive for 10 min so rapid switches always hit cache,
    // not the network.
    gcTime: 10 * 60 * 1000,
    select: (data) => ({
      pages: data.pages,
      pageParams: data.pageParams,
      messages: [...data.pages].reverse().flatMap((page) => [...page.content].reverse()),
    }),
  })
}
```

**Verify:** `pnpm build` passes. No TypeScript errors.

---

## Task 2 — Fix STOMP subscription: callbacks via refs

**File:** `apps/web/app/(main)/conversations/[id]/page.tsx`

The STOMP `useEffect` currently captures `patchMessage`, `appendMessage`, `attachAiSources`,
`markMessageRead` in its closure, making them part of the dep array. Each `id` change recreates
these functions → effect re-runs → subscription torn down and rebuilt → async gap = lost messages.

**Fix:** Store callbacks in a ref. The subscription closure reads from the ref so it always
has the latest version without the effect needing to re-run.

### Step 1 — Add a callback ref

Directly after the `useMessageCache(id)` call, add:

```ts
const { patchMessage, markMessageRead, appendMessage, attachAiSources } = useMessageCache(id)

// Store message-cache callbacks in a ref so the STOMP subscription effect
// only needs [id, stompConnected] in its dep array. The ref always holds the
// latest version of each callback so stale-closure bugs are impossible.
const msgCallbacksRef = useRef({ patchMessage, markMessageRead, appendMessage, attachAiSources })
useEffect(() => {
  msgCallbacksRef.current = { patchMessage, markMessageRead, appendMessage, attachAiSources }
})
```

### Step 2 — Update the STOMP subscription effect

Replace every direct call to `patchMessage`, `appendMessage`, `attachAiSources`,
`markMessageRead` inside the STOMP `useEffect` with `msgCallbacksRef.current.<name>`.

Example:
```ts
// BEFORE
appendMessage(msg)
patchMessage(parsed.messageId, { content: parsed.content, editedAt: parsed.editedAt })

// AFTER
msgCallbacksRef.current.appendMessage(msg)
msgCallbacksRef.current.patchMessage(parsed.messageId, { content: parsed.content, editedAt: parsed.editedAt })
```

Apply the same `msgCallbacksRef.current.` prefix to every occurrence of the four callbacks
inside the STOMP subscription callback body.

### Step 3 — Trim the dependency array

Remove `patchMessage`, `appendMessage`, `attachAiSources`, `markMessageRead` from the
`useEffect` dependency array. The array should now be:

```ts
}, [id, stompConnected, queryClient, currentUser?.id, t, armAiWatchdog, clearAiStream])
```

### Step 4 — Add `.catch()` to waitForConnect

The current code has no error handling if the STOMP connection fails during setup:

```ts
// BEFORE
stompService.waitForConnect().then(() => {
  if (!active) return
  messageSub = stompService.subscribe(...)
  typingSub = stompService.subscribe(...)
})

// AFTER
stompService.waitForConnect().then(() => {
  if (!active) return
  messageSub = stompService.subscribe(...)
  typingSub = stompService.subscribe(...)
}).catch(() => {
  // Connection failed — cleanup will handle retry via stompConnected changing
})
```

**Verify:** `pnpm build` passes. ESLint passes (the `react-hooks/exhaustive-deps` rule may need
a comment suppression for `msgCallbacksRef` — add `// eslint-disable-next-line` if needed).

---

## Task 3 — Fix sentReadRef: reset on conversation switch

**File:** `apps/web/app/(main)/conversations/[id]/page.tsx`

`sentReadRef` accumulates message IDs across all conversation switches (it's a single ref that
persists for the component's lifetime). When returning to conversation A after visiting B and C,
messages from A that were previously marked-read are in the Set and will never be re-sent.
This is mostly correct behaviour, but the Set can grow unboundedly in long sessions.

More importantly: the ref captures IDs from OLD conversations, which wastes memory and can
cause subtle bugs if IDs collide across conversations.

**Fix:** Reset the ref when `id` changes.

```ts
const sentReadRef = useRef<Set<string>>(new Set())

// Reset the sent-read set when switching conversations so we don't carry
// over IDs from a previous thread into the new one.
useEffect(() => {
  sentReadRef.current = new Set()
}, [id])
```

Add this effect immediately after the `sentReadRef` declaration.

**Verify:** `pnpm build` passes.

---

## Manual verification

1. Open PON web. Open conversation A (note the messages).
2. Rapidly click: B → C → A → B → C → A (at least 4–5 times, as fast as possible).
3. Stop on any conversation. Messages must be visible — no blank screen.
4. Reload the page. Messages still there.
5. Send a message in any conversation after rapid switching — it must appear normally.
6. Open DevTools Network tab during rapid switching — there should be at most 1 in-flight
   `/messages` request per conversation (not multiple simultaneous ones).
