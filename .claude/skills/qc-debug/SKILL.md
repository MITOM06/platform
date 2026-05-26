# SKILL: Full-Project QC & Debug — PON
> 3 services: auth-service (NestJS) · chat-service (Spring Boot) · client (Flutter)
> Gemini = QC reviewer | Claude = executor & fixer
> Chạy TRƯỚC khi build tính năng mới. Mục tiêu: 0 lỗi, 0 warning có giá trị.

---

## GEMINI: Đọc file này và thực hiện PHASE 5 (Code Review)
## CLAUDE: Đọc file này và thực hiện PHASE 1→4, sau đó fix issues từ PHASE 5

---

## PHASE 1 — Static Analysis (Claude chạy)

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

**Dừng nếu có lỗi. Fix trước khi qua Phase 2.**

---

## PHASE 2 — Unit Tests (Claude chạy)

```bash
# Auth-service
cd apps/server/auth-service
pnpm test 2>&1 | tail -15
# Mong đợi: PASS, 0 failed

# Chat-service
cd apps/server/chat-service  
mvn test 2>&1 | grep -E "Tests run|FAIL|ERROR|BUILD"
# Mong đợi: Tests run: 24+, Failures: 0, Errors: 0

# Flutter
cd apps/client
flutter test 2>&1 | tail -10
# Mong đợi: All tests passed
```

---

## PHASE 3 — Smoke Test Local (cần services đang chạy)

### Start infra
```bash
docker compose -f infra/docker-compose/compose.yml up -d
# Chờ healthy trước khi tiếp tục
```

### Start services (user mở 2 terminal)
```
Terminal 1: pnpm --filter @platform/auth-service start:dev
Terminal 2: cd apps/server/chat-service && mvn spring-boot:run
```

### Health checks
```bash
curl -sf http://localhost:3001/health && echo " ✓ auth" || echo " ✗ auth DOWN"
curl -sf http://localhost:8080/health && echo " ✓ chat" || echo " ✗ chat DOWN"
```

---

## PHASE 4 — API Integration Test (Claude chạy curl)

```bash
# ── SETUP: tạo 2 user test ──────────────────────────────────────
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

**Kết quả mong đợi:**
- Auth: 200 + accessToken ✓
- `/api/users/me`: 200 + {displayName, avatar} ✓
- `/api/conversations`: 200 (không phải 401) ✓ ← JWT_SECRET alignment test
- Conversation tạo được ✓
- Message gửi được ✓

---

## PHASE 5 — Code Review Checklist (GEMINI thực hiện)

Gemini đọc toàn bộ file source (dùng 2M context window) và check từng mục:

### AUTH-SERVICE
```
ENDPOINTS
□ GET /api/users/me — tồn tại, JWT guard, trả {id, displayName, avatar, email}
□ GET /api/users/:id — tồn tại, JWT guard, trả public profile (KHÔNG password)
□ GET /api/users/search?q= — tồn tại, tìm theo email/displayName
□ POST /auth/verify-otp — xử lý OTP dùng 1 lần (xóa sau khi dùng?)

SECURITY
□ Password không bao giờ nằm trong response (select('+password') chỉ khi cần)
□ OTP expires được check (không accept OTP hết hạn)
□ Rate limiting/lockout logic tồn tại

JWT
□ JWT_ACCESS_SECRET được dùng nhất quán
□ accessToken và refreshToken có expires khác nhau
□ Refresh token rotation khi dùng

DEAD CODE
□ ws/ws-auth.middleware.ts — đang dùng hay orphaned?
```

### CHAT-SERVICE
```
JWT ALIGNMENT
□ JWT_SECRET trong .env = JWT_ACCESS_SECRET trong auth-service .env
□ application.yml KHÔNG có fallback hardcoded (fail fast nếu env missing)
□ JwtUtil.extractUserId() lấy đúng claim (sub = userId từ auth-service)

WEBSOCKET
□ PresenceEventListener dùng SessionConnectedEvent (KHÔNG SessionConnectEvent)
□ ChatController.typing() broadcast có đủ: {conversationId, userId, typing: Boolean}
□ Redis TTL refresh trên mọi STOMP message
□ Personal notifications: /user/{id}/queue/notifications (KHÔNG /topic/)

NULL SAFETY
□ ChatController.send() — principal không null (đã guard bởi interceptor)
□ getParticipants() — trả List.of() khi không tìm thấy (không null)
□ UserStatusController — xử lý userId không tồn tại trong Redis

DATA
□ markAsRead() dùng $addToSet (atomic, không race condition)
□ sendMessage() update lastMessage trong Conversation
□ Pagination metadata đầy đủ: page, size, totalElements, hasNext
```

### FLUTTER CLIENT
```
API INTEGRATION
□ DioClient auth base URL: http://localhost:3001
□ DioClient chat base URL: http://localhost:8080
□ Authorization header được attach tự động qua interceptor
□ 401 → auto refresh token → retry (không loop vô hạn)
□ Token refresh fail → force logout

STOMP
□ stompConnectHeaders có Authorization: Bearer $token
□ subscribeNotifications() được gọi sau onConnect
□ disconnect() được gọi trong AppLifecycleState.paused
□ Reconnect tự động với subscriptions được restore

UI STATE
□ Mọi async operation có loading state
□ Mọi async operation có error state visible (không silent fail)
□ Conversation list hiển thị displayName (không raw userId)
□ Message bubble hiển thị sender name (không raw senderId)
□ ConversationListScreen refresh sau khi tạo conversation mới

MISSING FEATURE CHECK
□ Có màn hình tạo conversation mới không? (new_conversation_screen.dart)
□ Có search user bằng email trước khi tạo conversation không?
□ Read receipts hiển thị đúng (tick xanh khi đối phương đọc)?
```

### INTEGRATION
```
□ JWT token từ auth-service → chat-service accept 200 (không 401/403)
□ userId trong JWT (sub claim) nhất quán giữa 2 services
□ User displayName/avatar có thể resolve từ chat UI (cần /api/users/:id)
□ New conversation flow: search user → create → navigate to chat
```

---

## GEMINI: FORMAT KẾT QUẢ

Sau khi review, ghi vào `TODO.md` phần `## 🔴 FIX NOTES — Sprint QC`:

```markdown
## 🔴 FIX NOTES — Sprint QC [date]

### CRITICAL (block chạy app)
- [auth-service/users.module.ts] Thiếu UsersController → GET /api/users/me không tồn tại → Flutter không lấy được profile
- [chat-service/.env + application.yml] JWT_SECRET fallback hardcoded → auth sẽ fail nếu env không set

### HIGH (feature broken)
- [file:method] Mô tả → Cách fix

### LOW (code smell / warning)
- [file] Mô tả
```

---

## CLAUDE: FORMAT REPORT SAU KHI FIX

Ghi vào `TODO.md` phần `🧪 QA LOG`:
```
QC Full [date]
Phase 1: auth build ✓/✗ | chat compile ✓/✗ | flutter analyze ✓/✗
Phase 2: auth test N/N | chat test N/N | flutter test N/N  
Phase 3: infra ✓ | auth-svc ✓/✗ | chat-svc ✓/✗
Phase 4: jwt ✓/✗ | profile ✓/✗ | conversation ✓/✗ | message ✓/✗
Phase 5 issues fixed: N (list tên)
Status: CLEAN / N issues remaining
```
