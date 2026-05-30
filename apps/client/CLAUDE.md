# Flutter Client Context

## Tech Stack

- **Flutter SDK 3.44.0**, **Dart 3.x**
- State management: **Riverpod** (`flutter_riverpod` + `riverpod_annotation`)
- HTTP: **Dio** với interceptor auto-attach JWT
- WebSocket: **stomp_dart_client** (STOMP over raw WebSocket)
- Navigation: **go_router**
- Local storage: **flutter_secure_storage** (tokens), **shared_preferences** (settings)
- UI: Material 3 + Dark Neon Theme (NeonButton, NeonTextField, NeonCard)

## API Endpoints

| Service | Base URL | Dùng cho |
|---------|----------|---------|
| auth-service | `http://localhost:3001` | Login, Register, OTP, Token refresh, User search |
| chat-service | `http://localhost:8080` | Conversations, Messages, User status |
| chat WebSocket | `ws://localhost:8080/ws` | Realtime STOMP (raw WS, không SockJS) |

## Màn hình đã implement ✅

- `LoginScreen`, `RegisterScreen`, `VerifyOtpScreen`, `ForgotPasswordScreen`, `NewPasswordScreen`
- `ConversationListScreen`, `ChatScreen`, `NewConversationScreen`, `SettingsScreen`

## Cấu trúc thư mục Flutter

```
lib/
├── core/
│   ├── api/          # DioClient (authDio + chatDio) + interceptors
│   ├── router/       # go_router + RouterNotifier
│   ├── theme/        # AppTheme (neon dark)
│   └── widgets/      # NeonButton, NeonTextField, NeonCard, PonLogo
├── features/
│   ├── auth/
│   │   ├── data/     # AuthRepository (login/register/OTP/searchUsers)
│   │   ├── domain/   # AuthState, UserModel, AuthNotifier
│   │   └── ui/       # 5 auth screens
│   └── chat/
│       ├── data/     # ChatRepository, StompService (keepAlive)
│       ├── domain/   # ChatState, ChatNotifier, ConversationsNotifier
│       └── ui/       # ChatScreen, ConversationListScreen, NewConversationScreen + widgets
└── main.dart
```

## Code Conventions

- Feature-based layout: `lib/features/<name>/{data,domain,ui}/`
- Business logic trong provider/notifier, KHÔNG trong widget
- Mỗi screen `extends ConsumerWidget` hoặc `ConsumerStatefulWidget`
- Async state: `AsyncValue.when(data:, loading:, error:)` — không để trống error case
- Navigation: `go_router` only — không dùng `Navigator.push` trực tiếp
- Null safety: full Dart 3 — không `!` force-unwrap không có lý do
- `withValues(alpha:)` thay `withOpacity()` (deprecated Flutter 3.44)
