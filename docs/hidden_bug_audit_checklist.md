# Hidden Bug Audit Checklist & Verification Playbook

This playbook outlines advanced diagnostics and verification steps for auditing the Platform system (Next.js web client, Spring Boot chat-service, NestJS auth-service, and Flutter mobile client). Use this checklist periodically or after major sprint integrations to identify latent bugs, race conditions, memory leaks, and state synchronization issues.

---

## 1. Authentication & Session Hydration Audit

### Hydration Mismatch & Session Loss
*   **The Bug:** The Zustand store runs in client-side memory. httpOnly cookies are hidden from client-side JS (`document.cookie`). Upon page refresh (F5), the Zustand store is wiped out. If the client does not have a dedicated `/api/auth/session` endpoint to fetch the user profile and restore the in-memory `accessToken` on bootstrap, the user will be forced to log in again.
*   **Audit Steps:**
    1. Log in to the application.
    2. Open Chrome DevTools Console, check that Zustand state holds the user and `accessToken`.
    3. Press F5 (Hard Reload).
    4. Verify the user remains logged in and the sidebar displays the user's name without redirecting to `/login`.
*   **Middleware Bypass:**
    1. Set the cookie `accessToken` expiration to 10 seconds.
    2. Wait 10 seconds.
    3. Refresh the page.
    4. If the middleware redirects to `/login` immediately, it has bypassed the 30-day `refreshToken` cookie. The middleware should check if the `refreshToken` is present, and allow the client to perform a token refresh via route handler on boot.

### Concurrent 401 Request Collisions
*   **The Bug:** If the access token expires while a page makes multiple concurrent API requests (e.g., fetching profile, list of conversations, and notifications simultaneously), all requests will return 401. If the Axios response interceptor does not queue the failed requests during the refresh phase, it will spawn multiple duplicate refresh calls to the backend, causing token invalidation (since some refresh tokens are single-use) and race conditions.
*   **Audit Steps:**
    1. Clear `accessToken` from Zustand memory but keep `refreshToken` cookie.
    2. Navigate to a dashboard page that triggers multiple REST requests at the exact same moment.
    3. Open the Network tab in DevTools.
    4. Verify that exactly **one** `/auth/refresh` request is sent, and all queued API calls wait for it to complete before retrying with the new token.

---

## 2. STOMP WebSocket Connection & Subscription Audit

### Subscription Leaks on Unmount
*   **The Bug:** In Next.js App Router, changing routes (e.g., clicking on different conversations) mounts and unmounts pages. If the STOMP subscription objects (`messageSub`, `typingSub`) are not unsubscribed (`subscription.unsubscribe()`) in the cleanup function of `useEffect`, subscriptions will leak in memory. Multiple duplicate event handlers will trigger for incoming messages, causing UI lag, duplicate renders, and multiple sound notifications.
*   **Audit Steps:**
    1. Click on Conversation A, then B, then A, then B repeatedly (10-15 times).
    2. Send a message to Conversation A from another client.
    3. Verify in the Console/Network tab that the incoming STOMP message event handler fires exactly **once**.

### STOMP Connection Deadlocks
*   **The Bug:** If the STOMP connection is severed (e.g., client goes offline or server restarts), the client must reconnect. If the STOMP client singleton is completely destroyed and set to `null` during unexpected disconnects, the auto-reconnection loop will halt, and the user will remain permanently offline without a visual indicator.
*   **Audit Steps:**
    1. Open the Chat application.
    2. Turn off your machine's Wi-Fi.
    3. Verify that the UI displays a "Reconnecting..." or "Offline" status.
    4. Turn on Wi-Fi again.
    5. Verify the connection is automatically restored, and the offline message queue is fetched to catch up on missed messages.

---

## 3. Message Thread Pagination & Order Audit

### Chronological Rendering Inconsistencies
*   **The Bug:** The Spring Boot backend returns message lists ordered DESC (newest message first) to make cursor-based slicing simple. For standard downwards chat windows, the client needs the messages array sorted ASC (oldest first). If the client flattens pages from TanStack Query `useInfiniteQuery` without reversing the content array of *each* page individually, the messages will render in mixed-up segments (e.g., `[M2, M1, M4, M3]`).
*   **Audit Steps:**
    1. Fetch multiple pages of history in a chat thread by scrolling up.
    2. Read the sequence of messages and verify they read continuously from top to bottom.
    3. Cross-reference message timestamps to ensure there are no out-of-order bubbles.

### Cache Mutation Corruption
*   **The Bug:** When a new message is sent or received via WebSocket, the client appends it directly to the query cache. If the cache stores pages in descending order, appending (`content: [...page.content, incoming]`) places the newest message at the end of the page array, violating the descending contract of the query cache. When the next page is fetched, the cursor becomes misaligned, causing duplicated messages or query failure.
*   **Audit Steps:**
    1. Open a conversation.
    2. Send 5 new messages.
    3. Scroll to the top to trigger historical page loading (`fetchNextPage`).
    4. Check for warning/error logs and verify no duplicate messages appear.

---

## 4. User Profile & Direct Messages Resolution Audit

### Fallback Name Leakage
*   **The Bug:** Direct message conversations do not have a hardcoded name in the database. If the client fails to fetch the other participant's details, the sidebar and header will fall back to `"Conversation"`, `"Group"`, or generic text, losing personalization.
*   **Audit Steps:**
    1. Load the sidebar.
    2. Ensure that every one-on-one chat shows the real display name and avatar of the recipient instead of a generic fallback.
    3. Ensure that when chatting with an AI Bot (`ai-bot-000000000000000000000001`), the UI renders the `'AI Assistant'` name and a dedicated `'AI'` badge.

---

## 5. Diagnostic Commands & Scripts

### A. Run Local Static Analysis
Run this to catch TypeScript compilation issues, dead code, and linter violations:
```bash
# In the workspace root:
pnpm run lint
pnpm --filter @platform/web build
```

### B. Analyze Memory Leaks
To test for memory leaks or subscription buildup in Chrome:
1. Open DevTools -> **Memory** tab.
2. Select **Heap snapshot** -> Take snapshot.
3. Perform chat operations (switching rooms, sending messages, typing).
4. Take a second snapshot.
5. Filter by `@stomp/stompjs` or `Subscriber` classes to see if they accumulate.

### C. Check Docker Cleanliness
If Docker containers crash or experience storage pressure due to logs/caches:
```bash
# Clean unused dangling images and build cache
docker system prune -f --volumes
docker builder prune -f
```
