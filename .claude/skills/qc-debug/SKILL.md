# SKILL: Full-Project QC & Debug — PON
> 3 services: auth-service (NestJS) · chat-service (Spring Boot) · client (Flutter)
> Gemini = QC reviewer | Claude = executor & fixer
> Run BEFORE building any new features. Target: 0 errors, 0 valuable warnings.

---

## GEMINI: Read this file and perform PHASE 5 (Code Review)
## CLAUDE: Read this file and perform PHASE 1→4, then fix issues from PHASE 5

---

## PHASE 1 — Static Analysis (Run by Claude)

```bash
# Auth-service
cd apps/server/auth-service
pnpm build 2>&1 | tail -20

# Chat-service  
cd apps/server/chat-service
mvn clean compile -q 2>&1

# Flutter
cd apps/client
flutter analyze 2>&1
```

**Stop if there are errors. Fix them before proceeding to Phase 2.**

---

## PHASE 2 — Unit Tests (Run by Claude)

```bash
# Auth-service
cd apps/server/auth-service
pnpm test 2>&1 | tail -15
# Expected: PASS, 0 failed

# Chat-service
cd apps/server/chat-service  
mvn test 2>&1 | grep -E "Tests run|FAIL|ERROR|BUILD"
# Expected: Tests run: 24+, Failures: 0, Errors: 0

# Flutter
cd apps/client
flutter test 2>&1 | tail -10
# Expected: All tests passed
```

---

## PHASE 3 — Smoke Test Local (requires running services)

### Start infra
```bash
docker compose -f infra/docker-compose/compose.yml up -d
# Wait for healthy status before continuing
```

### Start services (user opens 2 terminals)
```text
Terminal 1: pnpm --filter @platform/auth-service start:dev
Terminal 2: cd apps/server/chat-service && mvn spring-boot:run
```

### Health checks
```bash
curl -sf http://localhost:3001/health && echo " ✓ auth" || echo " ✗ auth DOWN"
curl -sf http://localhost:8080/health && echo " ✓ chat" || echo " ✗ chat DOWN"
```

---

## PHASE 4 — API Integration Test (Claude runs curl)

```bash
# ── SETUP: create 2 test users ──────────────────────────────────────
curl -s -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@pon.dev","password":"Test1234!","displayName":"Alice"}' | python3 -m json.tool

curl -s -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@pon.dev","password":"Test1234!","displayName":"Bob"}' | python3 -m json.tool

# ── AUTH FLOW ────────────────────────────────────────────────────
LOGIN_A=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@pon.dev","password":"Test1234!"}')
JWT_A=$(echo $LOGIN_A | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken','MISSING'))")
echo "JWT_A: ${JWT_A:0:50}..."

LOGIN_B=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@pon.dev","password":"Test1234!"}')
JWT_B=$(echo $LOGIN_B | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken','MISSING'))")
USER_B_ID=$(echo $LOGIN_B | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('user',{}).get('id','') or d.get('userId','') or d.get('sub','MISSING'))")
echo "USER_B_ID: $USER_B_ID"

# ── USER PROFILE (auth-service) ──────────────────────────────────
echo "--- GET /api/users/me ---"
curl -s http://localhost:3001/api/users/me \
  -H "Authorization: Bearer $JWT_A" | python3 -m json.tool

echo "--- GET /api/users/search?q=bob ---"
curl -s "http://localhost:3001/api/users/search?q=bob" \
  -H "Authorization: Bearer $JWT_A" | python3 -m json.tool

# ── CHAT-SERVICE: JWT validation ─────────────────────────────────
echo "--- GET /api/conversations (expect 200, not 401) ---"
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/conversations \
  -H "Authorization: Bearer $JWT_A"

# ── CONVERSATION FLOW ────────────────────────────────────────────
echo ""
echo "--- POST /api/conversations ---"
CONV=$(curl -s -X POST http://localhost:8080/api/conversations \
  -H "Authorization: Bearer $JWT_A" \
  -H "Content-Type: application/json" \
  -d "{\"participantId\":\"$USER_B_ID\"}")
echo $CONV | python3 -m json.tool
CONV_ID=$(echo $CONV | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','MISSING'))")

# ── MESSAGE FLOW ─────────────────────────────────────────────────
echo "--- POST /api/messages ---"
curl -s -X POST http://localhost:8080/api/messages \
  -H "Authorization: Bearer $JWT_A" \
  -H "Content-Type: application/json" \
  -d "{\"conversationId\":\"$CONV_ID\",\"content\":\"Hello Bob!\",\"type\":\"text\"}" \
  | python3 -m json.tool

echo "--- GET /api/conversations/$CONV_ID/messages ---"
curl -s "http://localhost:8080/api/conversations/$CONV_ID/messages?page=0&size=5" \
  -H "Authorization: Bearer $JWT_A" | python3 -m json.tool

# ── PRESENCE ─────────────────────────────────────────────────────
echo "--- GET /api/users/$USER_B_ID/status ---"
curl -s "http://localhost:8080/api/users/$USER_B_ID/status" \
  -H "Authorization: Bearer $JWT_A" | python3 -m json.tool
```

**Expected Results:**
- Auth: 200 + accessToken ✓
- `/api/users/me`: 200 + {displayName, avatar} ✓
- `/api/conversations`: 200 (not 401) ✓ ← JWT_SECRET alignment test
- Conversation created successfully ✓
- Message sent successfully ✓

---

## PHASE 5 — Code Review Checklist (GEMINI executes)

Gemini reads all source files and checks each item:

### AUTH-SERVICE
```text
ENDPOINTS
□ GET /api/users/me — exists, JWT guard, returns {id, displayName, avatar, email}
□ GET /api/users/:id — exists, JWT guard, returns public profile (NO password)
□ GET /api/users/search?q= — exists, searches by email/displayName
□ POST /auth/verify-otp — handles one-time OTP (deleted after use?)

SECURITY
□ Password never included in responses (select('+password') only when needed)
□ OTP expires are checked (does not accept expired OTPs)
□ Rate limiting/lockout logic exists

JWT
□ JWT_ACCESS_SECRET used consistently
□ accessToken and refreshToken have different expiration times
□ Refresh token rotation implemented

DEAD CODE
□ ws/ws-auth.middleware.ts — active or orphaned?
```

### CHAT-SERVICE
```text
JWT ALIGNMENT
□ JWT_SECRET in .env = JWT_ACCESS_SECRET in auth-service .env
□ application.yml has NO hardcoded fallbacks (fail-fast if env missing)
□ JwtUtil.extractUserId() retrieves correct claim (sub = userId from auth-service)

WEBSOCKET
□ PresenceEventListener uses SessionConnectedEvent (NOT SessionConnectEvent)
□ ChatController.typing() broadcast includes: {conversationId, userId, typing: Boolean}
□ Redis TTL refreshed on every STOMP message
□ Personal notifications destination: /user/{id}/queue/notifications (NOT /topic/)

NULL SAFETY
□ ChatController.send() — principal is not null (guarded by interceptor)
□ getParticipants() — returns List.of() when not found (not null)
□ UserStatusController — handles non-existent userId in Redis

DATA
□ markAsRead() uses $addToSet (atomic, avoids race conditions)
□ sendMessage() updates lastMessage in Conversation
□ Pagination metadata is complete: page, size, totalElements, hasNext
```

### FLUTTER CLIENT
```text
API INTEGRATION
□ DioClient auth base URL: http://localhost:3001
□ DioClient chat base URL: http://localhost:8080
□ Authorization header automatically attached via interceptor
□ 401 → auto token refresh → retry (no infinite loop)
□ Token refresh fail → force logout

STOMP
□ stompConnectHeaders contains Authorization: Bearer $token
□ subscribeNotifications() called after onConnect
□ disconnect() called during AppLifecycleState.paused
□ Reconnections auto-restore subscriptions

UI STATE
□ All async operations have loading states
□ All async operations display visible error state (no silent fails)
□ Conversation list displays displayName (no raw userId)
□ Message bubble displays sender name (no raw senderId)
□ ConversationListScreen refreshes after creating a new conversation

MISSING FEATURE CHECK
□ Is there a screen to create a new conversation? (new_conversation_screen.dart)
□ Does it search for a user by email before creation?
□ Read receipts render correctly (blue ticks when read)?
```

### INTEGRATION
```text
□ JWT token from auth-service → chat-service accepts 200 (not 401/403)
□ userId in JWT (sub claim) is consistent between both services
□ User displayName/avatar resolves in chat UI (needs /api/users/:id)
□ New conversation flow: search user → create → navigate to chat
```

---

## GEMINI: FORMAT OUTPUT

After review, record issues in `TODO.md` under `## 🔴 FIX NOTES — Sprint QC`:

```markdown
## 🔴 FIX NOTES — Sprint QC [date]

### CRITICAL (blocks app execution)
- [auth-service/users.module.ts] Missing UsersController → GET /api/users/me not found → Flutter cannot retrieve profile
- [chat-service/.env + application.yml] JWT_SECRET hardcoded fallback → auth will fail if env is not set

### HIGH (broken features)
- [file:method] Description → How to fix

### LOW (code smell / warning)
- [file] Description
```

---

## CLAUDE: FORMAT REPORT AFTER FIX

Record in `TODO.md` under `🧪 QA LOG`:
```text
QC Full [date]
Phase 1: auth build ✓/✗ | chat compile ✓/✗ | flutter analyze ✓/✗
Phase 2: auth test N/N | chat test N/N | flutter test N/N  
Phase 3: infra ✓ | auth-svc ✓/✗ | chat-svc ✓/✗
Phase 4: jwt ✓/✗ | profile ✓/✗ | conversation ✓/✗ | message ✓/✗
Phase 5 issues fixed: N (list names)
Status: CLEAN / N issues remaining
```
