# Flutter Client Context

## Tech Stack

- **Flutter SDK 3.44.0**, **Dart 3.x**
- State management: **Riverpod** (`flutter_riverpod` + `riverpod_annotation`)
- HTTP: **Dio** with auto-attach JWT interceptor
- WebSocket: **stomp_dart_client** (STOMP over raw WebSocket)
- Navigation: **go_router**
- Local storage: **flutter_secure_storage** (tokens), **shared_preferences** (settings)
- UI: Material 3 + Dark Neon Theme (NeonButton, NeonTextField, NeonCard)

## API Endpoints

| Service | Base URL | Used for |
|---------|----------|---------|
| auth-service | `http://localhost:3001` | Login, Register, OTP, Token refresh, User search |
| chat-service | `http://localhost:8080` | Conversations, Messages, User status |
| chat WebSocket | `ws://localhost:8080/ws` | Realtime STOMP (raw WS, no SockJS) |

## Implemented Screens ✅

- `LoginScreen`, `RegisterScreen`, `VerifyOtpScreen`, `ForgotPasswordScreen`, `NewPasswordScreen`
- `ConversationListScreen`, `ChatScreen`, `NewConversationScreen`, `SettingsScreen`

## Flutter Directory Structure

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
- Business logic in provider/notifier, NOT in widgets
- Each screen `extends ConsumerWidget` or `ConsumerStatefulWidget`
- Async state: `AsyncValue.when(data:, loading:, error:)` — never leave error case empty
- Navigation: `go_router` only — do not use `Navigator.push` directly
- Null safety: full Dart 3 — no `!` force-unwrap without justification
- `withValues(alpha:)` instead of `withOpacity()` (deprecated Flutter 3.44)

## i18n (Multi-language) — REQUIRED

- App supports 7 languages (en/vi/zh/ja/ko/es/fr). **No hardcoded** display strings —
  always use `context.l10n.<key>` (`lib/core/l10n/l10n_ext.dart`).
- Template ARB: `lib/l10n/app_en.arb`. Adding new UI → add key to **all 7** `app_*.arb`,
  then run `flutter gen-l10n`. Files `app_localizations*.dart` are generated — do not edit manually.
- Language selected in Settings, persisted via `locale_provider.dart`. Details: `.claude/rules/i18n.md`.
