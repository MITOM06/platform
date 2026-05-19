# Flutter Client Context

## Tech Stack

- **Flutter SDK 3.x**, **Dart 3.x**
- State management: **Riverpod** (flutter_riverpod + riverpod_annotation)
- HTTP: **Dio** với interceptor tự động attach JWT
- WebSocket: **stomp_dart_client** (STOMP protocol)
- Navigation: **go_router**
- Local storage: **flutter_secure_storage** (tokens), **shared_preferences** (settings)
- UI: Material Design 3

## API Endpoints

| Service | Base URL | Dùng cho |
|---------|----------|---------|
| auth-service | `http://localhost:3001` | Login, Register, OTP, Token refresh |
| chat-service | `http://localhost:8080` | Conversations, Messages, REST |
| chat WebSocket | `ws://localhost:8080/ws` | Realtime chat (STOMP) |

## Màn hình cần implement

Auth flow (từ React Native cũ port sang — xem `apps/client/src/screens/Auth/` để tham khảo):
- `LoginScreen` → `POST /auth/login`
- `RegisterScreen` → `POST /auth/register`
- `VerifyOtpScreen` → `POST /auth/verify-otp`
- `ForgotPasswordScreen` → `POST /auth/forgot-password`

Chat flow (viết mới):
- `ConversationListScreen` → `GET /api/conversations`
- `ChatScreen` → WebSocket STOMP + `GET /api/conversations/{id}/messages`
- `SettingsScreen`

## Cấu trúc thư mục Flutter

```
lib/
├── core/
│   ├── api/          # Dio client + interceptors
│   ├── router/       # go_router config
│   └── theme/        # AppTheme, Colors
├── features/
│   ├── auth/
│   │   ├── data/     # AuthRepository, AuthApi
│   │   ├── domain/   # AuthState, User model
│   │   └── ui/       # Screens, Widgets
│   └── chat/
│       ├── data/     # ChatRepository, StompService
│       ├── domain/   # ChatState, Message model
│       └── ui/       # Screens, Widgets
└── main.dart
```

## Code Conventions

- Mỗi feature tách theo data/domain/ui
- Provider đặt trong file `*_provider.dart` riêng
- Models dùng `freezed` hoặc `copyWith` thủ công
- Không hard-code strings, dùng `AppStrings` constants
- Xử lý loading/error state trong mọi async operation
