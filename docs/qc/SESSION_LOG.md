# 🛡️ QC AUDIT LOG — PON PROJECT

Managed by: **Gemini Code Assist (Planner/QC Role)**

---

## [2026-05-25] Session: STOMP Reliability & Presence Fix

### 📝 Audit Content:
- **Task 7:** Fixed Principal loss in EventListener.
- **Task 8:** Synchronized Typing Indicator between Backend and Frontend.
- **Unit Test:** Updated test suite for `ChatController`.

### 🔍 Detailed Review Results:
1. **PresenceEventListener:** Claude migrated to `SessionConnectedEvent`. This is crucial as this event triggers *after* the CONNECT frame is successfully processed by the Interceptor.
   - *Status:* **PASS**.
2. **Typing Indicator:** `ChatMessageDto` now includes a `typing` field. Controller broadcasts correct payload `Map<String, Object>`.
   - *Status:* **PASS**.
3. **Regression Risk:** Required updating `ChatControllerTest.java` since the old code would fail due to the constructor change of `MessageResponse` (to a Record) and notification logic.
   - *Action:* Manually updated the test file to ensure the build succeeds.

### 🚩 Discovered & Resolved Issues:
- **Issue:** `PresenceEventListener` was still obtaining the Principal using the old method, risking null values if the handshake wasn't complete.
- **Fix:** Instructed Claude to use `StompHeaderAccessor.wrap(event.getMessage()).getUser()`.

---

## [2026-05-25] Session: WebSocket STOMP Foundation
- ✅ Tasks 1 to 6 complete and compilation verified.
- ✅ WebSocket layer protected by `AuthChannelInterceptor`.
- ✅ Redis Presence active for online tracking.

---

## [2026-05-25] Session: DevOps & Flutter UI (Task 9 & 10)

### 📝 Audit Content:
- **Task 9:** Dockerized chat-service and integrated Compose.
- **Task 10:** New conversation screen on Flutter.

### 🔍 Detailed Review Results:
1. **DevOps:** Dockerfile optimized via multi-stage build. Compose configures `chat-mongo` healthcheck correctly so Spring Boot awaits database readiness.
   - *Status:* **✅ PASS**.
2. **Flutter UI:** `NewConversationScreen` uses standard Form validator. Integrated FAB into the list screen for better accessibility.
   - *Status:* **✅ PASS**.

---

## [2026-05-25] Session: UI Refinement & Unit Testing (Task 11 & 12)

### 📝 Audit Content:
- **Task 11:** Online status and blue double-ticks on Flutter.
- **Task 12:** Unit test suite for Chat Service (Backend).

### 🔍 Detailed Review Results:
1. **Flutter:** `MessageBubble` handles opacity for pending messages to keep UI smooth. Read receipt logic using `readBy` list is correct.
   - *Status:* **✅ PASS**.
2. **Backend Test:** Test cases adequately cover security issues (invalid JWT, unauthorized access to conversation).
   - *Status:* **✅ PASS**.

---

## [2026-05-25] Session: Pre-Sprint 4 Refinement
### 🔍 Resolved Issues:
- Synchronized `ChatControllerTest` with the `Record` data type.
- Identified the "Stale Presence" vulnerability and added to Task 13.
- Planned real-time Read Receipts via WebSockets to optimize UX.

---

## [2026-05-25] Session: Sprint 4 Completion (Task 13 & 14)
### 🔍 Detailed Review Results:
1. **Heartbeat & Read Receipts**: `AuthChannelInterceptor` now extends Redis TTL on every frame, resolving the issue of users showing offline when idling. STOMP Read Receipt logic ensures instant UI synchronization.
2. **Pagination**: Pagination operates correctly at both ends. Loading spinner renders in the correct position without disrupting the ScrollView.
   - *Status:* **✅ QC PASS**.

---

## [2026-05-25] Session: Final Quality Gate (End of Day)
### 🔍 General Review Results:
- **Auth Flow:** Ensured consistency from JWT Filter (HTTP) to STOMP Interceptor (WS).
- **Performance:** Aggregation query and Redis Heartbeat function as designed to reduce system load.
- **Clean Code:** Reviewed and removed redundant code from Controller and Test classes.
   - *Status:* **💎 EXCELLENT (READY TO DEPLOY)**.