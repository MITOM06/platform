<div align="center">

# Platform Client

**Flutter 3 mobile app for the Platform messaging system**

[![Flutter](https://img.shields.io/badge/Flutter_3-02569B?style=flat-square&logo=flutter&logoColor=white)](https://flutter.dev)
[![Dart](https://img.shields.io/badge/Dart_3-0175C2?style=flat-square&logo=dart&logoColor=white)](https://dart.dev)
[![Riverpod](https://img.shields.io/badge/Riverpod-00C2CC?style=flat-square)](https://riverpod.dev)

</div>

---

## About

The Flutter client provides a cross-platform mobile UI (Android & iOS) for the Platform messaging system. It connects to two independent backend services:

| Backend | Base URL | Purpose |
|---------|----------|---------|
| auth-service | `http://localhost:3001` | Login, register, OTP, token refresh |
| chat-service | `http://localhost:8080` | Conversations, messages (REST + WebSocket) |

---

## Tech Stack

| Concern | Library |
|---------|---------|
| State management | `flutter_riverpod` + `riverpod_annotation` |
| Navigation | `go_router` |
| HTTP | `dio` with JWT interceptor + auto refresh |
| WebSocket | `stomp_dart_client` (STOMP over WS) |
| Secure storage | `flutter_secure_storage` (tokens) |
| Preferences | `shared_preferences` |
| UI | Material Design 3 |

---

## Project Structure

```
lib/
├── core/
│   ├── api/
│   │   ├── auth_dio.dart          # Dio instance → :3001 (auth-service)
│   │   └── chat_dio.dart          # Dio instance → :8080 (chat-service, with refresh)
│   ├── router/
│   │   ├── app_router.dart        # go_router config + RouterNotifier
│   │   └── app_router.g.dart      # generated
│   └── theme/
│       └── app_theme.dart
├── features/
│   ├── auth/
│   │   ├── data/                  # AuthRepository, AuthApi
│   │   ├── domain/                # AuthState, User model, AuthProvider
│   │   └── ui/                    # LoginScreen, RegisterScreen, VerifyOtpScreen
│   └── chat/
│       ├── data/                  # ChatRepository, StompService
│       ├── domain/                # ChatState, Message model, ChatProvider
│       └── ui/
│           ├── conversation_list_screen.dart
│           ├── chat_screen.dart
│           ├── new_conversation_screen.dart
│           └── widgets/
│               └── message_bubble.dart
└── main.dart
```

---

## Getting Started

### Prerequisites

- Flutter SDK 3.x — `brew install --cask flutter` or [flutter.dev](https://flutter.dev/docs/get-started/install)
- Both backend services running (see root [README](../../README.md))

### Setup

```bash
# Install dependencies
flutter pub get

# Generate go_router routes
dart run build_runner build --delete-conflicting-outputs

# Verify
flutter analyze
```

### Run

```bash
# Default device (emulator or connected phone)
flutter run

# Specific platform
flutter run -d android
flutter run -d ios
```

---

## Authentication Flow

```
LoginScreen
    │  POST /auth/login
    ▼
auth-service returns { accessToken, refreshToken }
    │  stored in flutter_secure_storage
    ▼
RouterNotifier watches AuthState → redirects to ChatScreen
```

Token refresh is handled automatically by the Dio interceptor on `chat-service` requests. If the refresh token itself is expired, the user is redirected to `LoginScreen`.

---

## WebSocket (STOMP)

The app connects to `ws://localhost:8080/ws` using STOMP over WebSocket:

```
Connect  →  STOMP CONNECT with Authorization: Bearer <token>
Subscribe → /topic/conversation/<id>  (incoming messages)
Publish  →  /app/chat.send            (send a message)
Subscribe → /user/queue/notifications (new conversation alerts)
```

The STOMP connection is managed by `StompService` in `lib/features/chat/data/`.

---

## Code Conventions

- Every screen is a `ConsumerWidget`; no `StatefulWidget` unless required for animations
- All async state uses `AsyncValue` with `.when(data:, loading:, error:)`
- Providers live in `*_provider.dart` files, never inside widgets
- No `Navigator.push` — `go_router` only
- No force-unwrap (`!`) without an inline comment explaining the invariant
