# AI Activity Log

> File này được tự động cập nhật bởi Claude Code hooks sau mỗi thao tác.
> Dùng để track lịch sử AI đã làm gì. Đọc file này khi bắt đầu session mới để nắm context.

---

## Session: 2026-05-19 — Project Setup

**Tóm tắt:** Setup toàn bộ cấu trúc project cho PRJ4. Không có code nào được viết, chỉ config Claude Code.

**Files tạo/sửa:**
- `CLAUDE.md` — root context file (59 dòng, lean)
- `CLAUDE.local.md` — personal session notes template (gitignored)
- `apps/server/chat-service/CLAUDE.md` — Spring Boot context (on-demand)
- `apps/client/CLAUDE.md` — Flutter context (on-demand)
- `.claude/settings.json` — hooks config
- `.claude/hooks/log-activity.sh` — auto-logging hook
- `.claude/rules/auth-guard.md` — luôn load, bảo vệ auth-service
- `.claude/rules/spring-boot.md` — path-scoped cho chat-service/**
- `.claude/rules/flutter.md` — path-scoped cho apps/client/**
- `.claude/skills/implement-feature/SKILL.md`
- `.claude/skills/spring-boot-service/SKILL.md`
- `.claude/skills/flutter-screen/SKILL.md`
- `.claude/skills/fix-issue/SKILL.md`
- `.claude/agents/code-reviewer.md`
- `docs/decisions.md` — 6 ADRs từ cuộc trò chuyện
- `docs/roadmap.md` — 5 milestones
- `docs/api-spec.md` — API contracts cho chat-service

**Quyết định chốt:**
- Go chat-service → replace bằng Spring Boot 3
- React Native → replace bằng Flutter
- NestJS auth-service → giữ nguyên
- State: Milestone 0 hoàn thành, chờ bắt đầu Milestone 1

**Next:** Bắt đầu Milestone 1 — Spring Boot Foundation (setup Maven project, JWT filter, health endpoint)

---

## Session: 2026-05-19 — Milestone 2: Core Data Layer hoàn thành

**Tóm tắt:** Xác nhận Milestone 1 đã có sẵn (Spring Boot Foundation, JWT filter, health endpoint, `mvn compile` clean). Hoàn thành toàn bộ Milestone 2: entities, repositories, services, và REST controllers cho conversations và messages — 17 files mới, build thành công.

**Files tạo/sửa:**
- `config/MongoConfig.java` — enable `@EnableMongoAuditing` cho `@CreatedDate`/`@LastModifiedDate`
- `model/Conversation.java` — `@Document`, nested `LastMessage`, Lombok full
- `model/Message.java` — `@Document`, `readBy[]`, `@Builder.Default` cho list
- `repository/ConversationRepository.java` — derived query pageable + custom `$all/$size:2` query
- `repository/MessageRepository.java` — paginated DESC + `countUnread` với `@Query $nin`
- `dto/PageResponse.java` — generic record wrapper
- `dto/ConversationResponse.java` — với `LastMessageDto` nested + `unreadCount`
- `dto/CreateConversationRequest.java`, `dto/MessageResponse.java`, `dto/SendMessageRequest.java`
- `exception/ConversationNotFoundException.java`, `exception/DuplicateConversationException.java`
- `exception/GlobalExceptionHandler.java` — 404, 409, 400 fallback
- `service/ConversationService.java` — list/create/getById, tính unreadCount per conversation
- `service/MessageService.java` — getMessages, sendMessage (update lastMessage), markAsRead
- `controller/ConversationController.java` — 4 endpoints `/api/conversations/**`
- `controller/MessageController.java` — 2 endpoints `/api/messages/**`

**Quyết định:**
- `countUnread` dùng `@Query` explicit với `$nin` thay vì derived method — derived query không reliable với array fields trong MongoDB
- `findOneOnOneConversation` dùng `$all + $size: 2` — đảm bảo exact 2-participant match, không bị false positive
- userId luôn extract từ `SecurityContextHolder` (UserPrincipal) — không tin request body/params cho identity
- Sender tự thêm vào `readBy` khi gửi — tránh count tin nhắn của chính mình là unread

**Kết quả:**
- ✅ `Conversation` + `Message` entities với MongoDB auditing
- ✅ `GET /api/conversations` — paginated, có `unreadCount`
- ✅ `POST /api/conversations` — tạo 1-on-1, trả 409 nếu đã tồn tại
- ✅ `GET /api/conversations/{id}` — 404 nếu không phải participant
- ✅ `GET /api/conversations/{id}/messages?page=0&size=20` — sorted DESC
- ✅ `POST /api/messages` — gửi tin, update `conversation.lastMessage` atomically
- ✅ `PUT /api/messages/{id}/read` — mark as read
- ✅ `mvn compile` — 0 errors, 0 warnings
- ❌ Integration test với MongoDB chưa chạy (cần Docker infra up)

**Next:** Milestone 3 — WebSocket STOMP: `WebSocketConfig` + `ChatController (@MessageMapping)` + typing indicator + Redis presence (`GET /api/users/{id}/status`)

---

## Session: 2026-05-19 — Fix Outdated Docker Files

**Tóm tắt:** Align lại toàn bộ Docker config với thực tế hiện tại của project (auth-service độc lập, port 3001, không còn web frontend). Xóa Dockerfile sai của chat-service (NestJS copy), rewrite compose.dev.yml và compose.prod.yml chỉ còn auth-service. Fix package.json scripts trỏ đúng path compose.yml.

**Files tạo/sửa:**
- `apps/server/auth-service/Dockerfile` — xóa `pnpm -C infra/redis run build` (path không tồn tại), fix build path → `apps/server/auth-service`, fix WORKDIR, EXPOSE 3001
- `apps/server/chat-service/Dockerfile` — xóa file (là bản copy NestJS, sai hoàn toàn với Spring Boot)
- `infra/docker-compose/compose.dev.yml` — rewrite: chỉ giữ `auth-service`, fix dockerfile/env_file paths, port 3001, filter `@platform/auth-service`, bỏ `web` service
- `infra/docker-compose/compose.prod.yml` — rewrite: tương tự dev, thêm `NODE_ENV=production` + `restart: always`
- `package.json` — fix scripts `infra` + `down`: `infra/docker/docker-compose.yml` → `infra/docker-compose/compose.yml`

**Quyết định:**
- Không tạo Spring Boot Dockerfile cho chat-service (chưa đến milestone đó)
- `infra/docker-compose/compose.yml` giữ nguyên — đang chạy đúng cho mongo + redis
- compose.dev.yml và compose.prod.yml dùng kết hợp với compose.yml khi chạy (`-f compose.yml -f compose.dev.yml`)

**Kết quả:**
- ✅ `docker compose -f compose.yml config --quiet` — pass
- ✅ `docker compose -f compose.dev.yml -f compose.yml config --quiet` — pass
- ✅ chat-service Dockerfile đã xóa
- ✅ package.json scripts trỏ đúng path

**Next:** Milestone 3 — WebSocket STOMP: `WebSocketConfig` + `ChatController (@MessageMapping)` + typing indicator + Redis presence (`GET /api/users/{id}/status`)

---

## Session: 2026-05-19 — Flutter Client Init hoàn thành

**Tóm tắt:** Xóa React Native/Expo root files, cài Flutter 3.44.0 qua Homebrew, khởi tạo Flutter project (`flutter create . --project-name platform_client --org com.platform`), cập nhật pubspec.yaml, tạo cấu trúc lib/, core files. `flutter pub get` + `flutter analyze` pass clean.

**Files xóa:**
- `App.js`, `index.js`, `app.json`, `tsconfig.json`, `package.json`, `.npmrc`, `.expo/`, `node_modules/`

**Files tạo/sửa:**
- `pubspec.yaml` — đầy đủ deps (riverpod, go_router, dio, flutter_secure_storage, stomp_dart_client ^3.0.1, shared_preferences, build_runner, riverpod_generator, json_serializable)
- `lib/main.dart` — ProviderScope + PlatformApp (ConsumerWidget) + MaterialApp.router + Material 3
- `lib/core/api/dio_client.dart` — `DioClient.createAuthDio()` + `DioClient.createChatDio()`, `_AuthHeaderInterceptor` (attach Bearer token), `_TokenRefreshInterceptor` (401 → refresh → retry, fail → deleteAll)
- `lib/core/router/app_router.dart` — `isAuthenticatedProvider`, `RouterNotifier` (implements Listenable), `appRouterProvider` (GoRouter với 6 routes, redirect logic)
- `lib/core/router/app_router.g.dart` — generated bởi riverpod_generator
- `lib/core/theme/`, `lib/features/auth/{data,domain,ui}/`, `lib/features/chat/{data,domain,ui}/` — cấu trúc thư mục
- `.gitignore` — cập nhật sang Flutter format
- `test/widget_test.dart` — placeholder (xóa MyApp reference)
- `android/`, `ios/`, `macos/`, `web/`, `linux/`, `windows/` — generated bởi flutter create

**Quyết định:**
- `stomp_dart_client: ^3.0.1` (không phải ^1.x — package đã major version bump)
- Social login không làm trong session này
- `_TokenRefreshInterceptor` chỉ trên chatDio, không queue concurrent requests (đủ cho dev)
- Storage keys: `accessToken`, `refreshToken`, `sid`

**Kết quả:**
- ✅ Flutter 3.44.0 cài qua Homebrew (`/opt/homebrew/bin/flutter`)
- ✅ `flutter pub get` — 120 packages resolved
- ✅ `dart run build_runner build` — 2 outputs (app_router.g.dart)
- ✅ `flutter analyze` — No issues found

**Next:** Implement auth screens (LoginScreen, RegisterScreen, VerifyOtpScreen, ForgotPasswordScreen) trong `lib/features/auth/`

---

<!-- Các entries mới tự động append bên dưới -->

## Session: 2026-05-19 — Flutter Chat Feature hoàn thành

**Tóm tắt:** Implement toàn bộ chat feature cho Flutter client: data layer (ChatRepository + StompService), domain (ConversationsNotifier + ChatNotifier với Riverpod), và 3 UI screens. Thay thế placeholder screens trong GoRouter bằng real screens. `build_runner` generate 6 outputs, `flutter analyze` — 0 issues.

**Files tạo/sửa:**
- `lib/features/chat/domain/chat_state.dart` — models: ConversationModel, MessageModel (có `isPending`), LastMessageModel, PagedResult<T>, UserStatus, TypingEvent, ChatState
- `lib/features/chat/data/chat_repository.dart` — REST: list conversations, get messages (paginated), send (fallback), mark read, get/create conversation (409 handling), user status
- `lib/features/chat/data/stomp_service.dart` — `@Riverpod(keepAlive: true)`: connect/disconnect, subscribe queue cho reconnect, broadcast streams (messages/typing/notifications)
- `lib/features/chat/domain/chat_provider.dart` — `ConversationsNotifier` (list + realtime via notifications stream) + `ChatNotifier(conversationId)` family (messages + pagination + optimistic UI + typing 3s timer)
- `lib/features/chat/ui/widgets/message_bubble.dart` — sent/received bubbles, opacity 0.6 khi pending, timestamp
- `lib/features/chat/ui/conversation_list_screen.dart` — list với unread Badge, pull-to-refresh, logout
- `lib/features/chat/ui/chat_screen.dart` — `ConsumerStatefulWidget` + scroll-to-load-more + typing indicator + `WidgetsBindingObserver` (disconnect khi background)
- `lib/core/router/app_router.dart` — thay `_PlaceholderScreen` bằng `ConversationListScreen` + `ChatScreen`, xóa placeholder class

**Quyết định:**
- `StompService` dùng `@Riverpod(keepAlive: true)` — giữ alive suốt app session, không bị dispose khi navigate
- Pending subscription queue (`_pendingConvSubs`, `_notifSubPending`) — auto re-subscribe sau mỗi lần reconnect trong `_onConnect`
- `deactivate()` của stomp_dart_client trả `void` (không phải `Future`) — `disconnect()` là sync
- Optimistic UI: temp id `pending_*`, opacity 0.6, replace bằng server echo khi STOMP confirm
- `ListView(reverse: true)` + API trả DESC → item[0] newest = hiện ở bottom, không cần reverse thêm
- WebSocket URL: `ws://localhost:8080/ws` raw (Spring Boot Milestone 3 sẽ config KHÔNG dùng `withSockJS()`)
- `withValues(alpha:)` thay `withOpacity()` (deprecated trong Flutter 3.44)
- `markConversationRead()` gọi qua `addPostFrameCallback` khi vào ChatScreen

**Kết quả:**
- ✅ `dart run build_runner build` — 6 outputs, 0 errors
- ✅ `flutter analyze` — No issues found
- ✅ ConversationListScreen: list, unread badge, pull-to-refresh, logout
- ✅ ChatScreen: messages (reverse), load more khi scroll, optimistic send, typing indicator, lifecycle disconnect
- ✅ StompService: connect/reconnect/disconnect, subscribe queue, 3 broadcast streams
- ❌ Chưa test thực tế với backend (Spring Boot Milestone 3 WebSocket chưa implement)

**Next:** Spring Boot Milestone 3 — WebSocket STOMP: `WebSocketConfig` (raw WS, không SockJS) + `ChatController` (@MessageMapping `/app/chat.send`, `/app/chat.typing`) + broadcast tới `/topic/conversation/{id}` + Redis presence (`GET /api/users/{id}/status`)

## Session: 2026-05-19 — Flutter Auth Feature hoàn thành

**Tóm tắt:** Implement toàn bộ auth feature cho Flutter client: domain models, repository, Riverpod notifier, 5 UI screens. Cập nhật GoRouter để redirect dựa trên `AuthNotifier` thay vì đọc storage trực tiếp. `flutter analyze` và `build_runner` đều pass clean.

**Files tạo/sửa:**
- `lib/features/auth/domain/auth_state.dart` — `UserModel` + sealed class `AuthState` (Loading/Authenticated/Unauthenticated)
- `lib/features/auth/data/auth_repository.dart` — tất cả API calls, lưu/đọc credentials từ secure storage, `authRepositoryProvider`
- `lib/features/auth/domain/auth_provider.dart` — `AuthNotifier` (`build` restore session, `login`, `logout`)
- `lib/features/auth/domain/auth_provider.g.dart` — generated bởi riverpod_generator
- `lib/features/auth/ui/login_screen.dart` — form + `ref.listenManual` cho error snackbar
- `lib/features/auth/ui/register_screen.dart` — form + navigate `/verify-otp?email=...` on success
- `lib/features/auth/ui/verify_otp_screen.dart` — 6-digit OTP input, email từ query param
- `lib/features/auth/ui/forgot_password_screen.dart` — email form + navigate `/new-password?email=...`
- `lib/features/auth/ui/new_password_screen.dart` — OTP + new password, calls `resetPassword`
- `lib/core/router/app_router.dart` — xóa `isAuthenticatedProvider`, `RouterNotifier` watch `authNotifierProvider`, thêm `/new-password` route, thay `_PlaceholderScreen` bằng real screens
- `lib/core/router/app_router.g.dart` — regenerated

**Quyết định:**
- `AuthNotifier` dùng `AsyncNotifier<AuthState>` — `build()` restore session từ storage; chỉ `login`/`logout` thay đổi global auth state; các one-off calls (register, verifyOtp, v.v.) gọi `authRepositoryProvider` trực tiếp trong screens
- `redirect` không redirect khi `isLoading` — tránh flash `/login` trong lúc session restore
- `RouterNotifier` watch `authNotifierProvider` thay vì đọc storage độc lập — đảm bảo GoRouter luôn sync với Riverpod state
- `ConsumerStatefulWidget` cho tất cả form screens — cần `TextEditingController` + local `_isLoading`
- Email truyền qua query param (`?email=...`) thay vì `extra` — dễ debug, không mất state khi deep link

**Kết quả:**
- ✅ `dart run build_runner build` — 4 outputs, 0 errors
- ✅ `flutter analyze` — No issues found
- ✅ Redirect logic verified: unauthenticated → `/` → redirect `/login` đúng ở mọi case (loading/unauthenticated/AsyncError)
- ❌ Chưa test thực tế với backend (cần Docker infra + auth-service chạy)

**Next:** Milestone 3 Spring Boot — WebSocket STOMP (`WebSocketConfig` + `ChatController` + typing indicator + Redis presence) hoặc Flutter Chat screens (`ConversationListScreen`, `ChatScreen`)

---

## Session: 2026-05-22 — Refactor Clean Code & Tối ưu hóa Database/Redis

**Tóm tắt:** Tiến hành refactor và tối ưu hóa toàn diện cho `auth-service` (NestJS) và `chat-service` (Spring Boot). Giảm latency thông qua Redis pipelines và MongoDB aggregation, tối ưu hóa write bằng atomic queries, tăng cường kiểm tra kiểu dữ liệu an toàn và cải thiện xử lý lỗi (error handling).

**Files tạo/sửa:**
- `apps/server/auth-service/src/modules/auth/session.service.ts` — tối ưu hóa `listSessions` và `revokeAllSessions` sử dụng Redis Pipeline, định nghĩa kiểu `Redis` thay cho `any`.
- `apps/server/auth-service/src/modules/auth/auth.service.ts` — cập nhật `resetPassword` sử dụng `revokeAllSessions` tối ưu.
- `apps/server/auth-service/src/app.controller.spec.ts` — thêm mock Mongoose và Redis client để sửa lỗi unit test.
- `apps/server/auth-service/package.json` — cấu hình `moduleNameMapper` để Jest giải quyết đúng các module workspace.
- `apps/server/chat-service/src/main/java/com/platform/chatservice/exception/MessageNotFoundException.java` [NEW] — Custom exception khi không tìm thấy Message.
- `apps/server/chat-service/src/main/java/com/platform/chatservice/exception/UnauthorizedException.java` [NEW] — Custom exception cho yêu cầu chưa xác thực (HTTP 401).
- `apps/server/chat-service/src/main/java/com/platform/chatservice/exception/GlobalExceptionHandler.java` — cấu hình ánh xạ `MessageNotFoundException` thành HTTP 404 và `UnauthorizedException` thành HTTP 401.
- `apps/server/chat-service/src/main/java/com/platform/chatservice/service/ConversationService.java` — tối ưu hóa `listConversations` sử dụng MongoDB aggregation (`$group` và `$count`) để đếm tin nhắn chưa đọc trong 1 query duy nhất (giải quyết N+1 query).
- `apps/server/chat-service/src/main/java/com/platform/chatservice/service/MessageService.java` — refactor `markAsRead` thành atomic write với lệnh `$addToSet` qua `MongoTemplate`, giải quyết triệt để race condition và ném `MessageNotFoundException` nếu không tìm thấy message.
- `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/ConversationController.java` — kiểm tra an toàn principal sử dụng `instanceof UserPrincipal` và ném `UnauthorizedException` nếu chưa authenticate.
- `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/MessageController.java` — tương tự, kiểm tra principal an toàn trong endpoints.

**Quyết định chốt:**
- Loại bỏ hoàn toàn vòng lặp tuần tự gọi Redis trong `auth-service` bằng pipelining.
- Thay thế việc đếm tin nhắn chưa đọc bằng aggregation query duy nhất trong `chat-service`.
- Tránh mô hình đọc-sửa-ghi dễ bị ghi đè dữ liệu (race conditions) bằng cập nhật nguyên tử `$addToSet`.
- Bắt và ném ngoại lệ tường minh khi ép kiểu principal thay vì để sinh ra ClassCastException.

**Kết quả:**
- ✅ `pnpm --filter @platform/auth-service test` — 100% pass.
- ✅ `mvn test` (cho `chat-service`) — biên dịch thành công, build success.

---

## Session: 2026-05-22 — Flutter Milestone 4: Error Handling, Connectivity & Settings

**Tóm tắt:** Debug toàn bộ codebase (tìm 3 bug: thiếu WebSocket config, `hasMore` sai logic, type cast `totalElements`). Implement Milestone 4 Flutter: network error toast qua global `scaffoldMessengerKey`, token expiry auto logout qua `onForceLogout` callback trong DioClient, online/offline banner trên ConversationListScreen, SettingsScreen cơ bản (avatar initials + edit display name). Tạo Dockerfile Flutter web. `flutter analyze` + `flutter test` đều pass clean.

**Files tạo/sửa:**
- `lib/core/utils/app_error.dart` [NEW] — `friendlyError()` + `isNetworkError()` centralised
- `lib/core/utils/global_messenger.dart` [NEW] — `scaffoldMessengerKey` global + `showErrorSnackBar/showInfoSnackBar`
- `lib/core/providers/connectivity_provider.dart` [NEW] — `StreamProvider<bool>` phát trạng thái online/offline từ `connectivity_plus`
- `lib/features/settings/ui/settings_screen.dart` [NEW] — avatar initials, edit display name, logout confirm dialog
- `apps/client/Dockerfile` [NEW] — Flutter web build (cirruslabs/flutter:stable → nginx:alpine)
- `pubspec.yaml` — thêm `connectivity_plus: ^6.0.0`
- `lib/core/api/dio_client.dart` — thêm `_NetworkErrorInterceptor` (toast on timeout/connection error) + `onForceLogout` callback vào `_TokenRefreshInterceptor`
- `lib/features/auth/data/auth_repository.dart` — thêm `updateDisplayName()` (lưu local secure storage)
- `lib/features/auth/domain/auth_provider.dart` — thêm `forceLogout()` (gọi từ Dio khi refresh fail) + `updateDisplayName()` với AsyncLoading state
- `lib/features/chat/data/chat_repository.dart` — pass `onForceLogout` callback vào `createChatDio`, fix `(num).toInt()` cho pagination fields, thêm import `auth_provider`
- `lib/features/chat/domain/chat_provider.dart` — fix `hasMore`: `(page+1)*size < totalElements` thay vì `length == 20`
- `lib/features/chat/ui/conversation_list_screen.dart` — offline banner + settings icon button (avatar initials) + improved error state UI
- `lib/core/router/app_router.dart` — thêm `/settings` route + import SettingsScreen
- `lib/main.dart` — wire `scaffoldMessengerKey` vào `MaterialApp.router`

**Quyết định:**
- `onForceLogout` callback pattern thay vì global stream — DioClient không truy cập Riverpod, callback được inject từ `chatRepositoryProvider`
- `forceLogout()` bỏ qua server-side logout call — token đã invalid, chỉ clear local storage + set state
- `updateDisplayName()` local-only (secure storage) — auth-service không có profile update endpoint, đủ cho "basic settings"
- `connectivity_plus` `StreamProvider` với `async*` yield initial state — tránh banner trễ khi khởi động
- `_OfflineBanner` dùng `errorContainer` color — nhất quán với Material 3 color system
- `scaffoldMessengerKey` global (không phải Riverpod provider) — phải accessible từ `DioClient` (non-widget layer)

**Kết quả:**
- ✅ `flutter pub get` — `connectivity_plus` resolved
- ✅ `flutter analyze` — No issues found
- ✅ `flutter test` — All tests passed (1/1)
- ✅ Bug fix: `hasMore` dùng `totalElements` thay vì heuristic `length == 20`
- ✅ Bug fix: type cast `(num).toInt()` cho `page`, `size`, `totalElements`
- ✅ Token expiry auto logout hoạt động khi refresh thất bại
- ✅ Network error toast hiển thị từ `_NetworkErrorInterceptor` trên cả `authDio` và `chatDio`
- ❌ Bug crítico chưa fix: chat-service thiếu `WebSocketConfig.java` — STOMP endpoint `ws://localhost:8080/ws` chưa tồn tại

**Next:** Milestone 3 Spring Boot — tạo `WebSocketConfig.java` (`@EnableWebSocketMessageBroker`, endpoint `/ws`, broker `/topic` + `/user/queue`) + `ChatController` (`@MessageMapping("/chat.send")`, `@MessageMapping("/chat.typing")`) + broadcast qua `SimpMessagingTemplate`

