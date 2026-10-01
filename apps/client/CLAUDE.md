# Flutter Client Context

## Tech Stack

- **Flutter 3.x** (Dart `>=3.0.0 <4.0.0` per pubspec)
- State management: **Riverpod** (`flutter_riverpod` + `riverpod_annotation`)
- HTTP: **Dio** with auto-attach JWT interceptor
- WebSocket: **stomp_dart_client** (STOMP over raw WebSocket)
- Navigation: **go_router**
- Local storage: **flutter_secure_storage** (tokens), **shared_preferences** (settings)
- UI: Material 3 themed as "Warm Grey & Burgundy" — tokens in `AppTheme`, shared widgets `PonButton` / `PonTextField` / `PonCard`. Spec and the list of places mobile still differs from web: `docs/design-system.md`

## API Endpoints

| Service | Base URL | Used for |
|---------|----------|---------|
| auth-service | `http://localhost:3001` | Login, Register, OTP, Token refresh, User search |
| chat-service | `http://localhost:8080` | Conversations, Messages, User status |
| chat WebSocket | `ws://localhost:8080/ws` | Realtime STOMP (raw WS, no SockJS) |

## Implemented Screens ✅

- **Auth**: `LoginScreen`, `RegisterScreen`, `VerifyOtpScreen`, `ForgotPasswordScreen`, `NewPasswordScreen`, `ThemeOnboardingScreen`
- **Chat & Media**: `ConversationListScreen`, `ChatScreen`, `NewConversationScreen`, `NewGroupScreen`, `GroupInfoScreen`, `ArchivedChatsScreen`, `ExploreScreen` (Public Channels), `ExploreMediaScreen` (Shared Gallery)
- **Calling**: `CallScreen` (WebRTC)
- **AI Integration**: `AiMemoryScreen` (Facts & memory), `AiPersonaScreen` (AI Settings), `KbScreen` (RAG Knowledge documents)
- **Settings & Profile**: `SettingsScreen`, `TokenUsageScreen` (Token usage progress), `UserProfileScreen`, `EditProfileScreen`
- **Other Features**: `FriendsScreen` (Contacts & Requests), `RemindersScreen` (User Reminders)

## Flutter Directory Structure

```
lib/
├── core/
│   ├── api/          # DioClient (authDio + chatDio) + interceptors
│   ├── router/       # go_router + RouterNotifier
│   ├── theme/        # AppTheme (light + dark tokens), AppMotion
│   ├── l10n/         # l10n extension (context.l10n)
│   ├── config/       # AppConfig (base URLs, flags)
│   ├── providers/    # cross-cutting providers (locale, connectivity, …)
│   ├── utils/        # helpers (media URLs, formatters, …)
│   ├── services/     # shared services (notifications, storage, …)
│   └── widgets/      # PonButton, PonTextField, PonCard, PonLogo
├── features/         # feature-based: <name>/{data,domain,ui}
│   ├── auth/
│   │   ├── data/     # AuthRepository (login/register/OTP/searchUsers)
│   │   ├── domain/   # AuthState, UserModel, AuthNotifier
│   │   └── ui/       # 6 auth screens
│   ├── chat/         # data / domain / ui / presentation (+ widgets)
│   └── …             # admin, ai_context, ai_hub, assistant, friends, help, home,
│                     # integrations, notifications, profile, reminders, settings, skills
└── main.dart
```

## Code Conventions

- Feature-based layout: `lib/features/<name>/{data,domain,ui}/`
- Business logic in provider/notifier, NOT in widgets
- Each screen `extends ConsumerWidget` or `ConsumerStatefulWidget`
- Async state: `AsyncValue.when(data:, loading:, error:)` — never leave error case empty
- Navigation: `go_router` only — do not use `Navigator.push` directly
- Null safety: full Dart 3 — no `!` force-unwrap without justification
- `withValues(alpha:)` instead of `withOpacity()` (deprecated in recent Flutter)

## i18n (Multi-language) — REQUIRED

- App supports 7 languages (en/vi/zh/ja/ko/es/fr). **No hardcoded** display strings —
  always use `context.l10n.<key>` (`lib/core/l10n/l10n_ext.dart`).
- Template ARB: `lib/l10n/app_en.arb`. Adding new UI → add key to **all 7** `app_*.arb`,
  then run `flutter gen-l10n`. Files `app_localizations*.dart` are generated — do not edit manually.
- Language selected in Settings, persisted via `locale_provider.dart`. Details: `.claude/rules/i18n.md`.
