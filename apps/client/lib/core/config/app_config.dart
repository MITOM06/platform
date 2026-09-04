import 'package:flutter/foundation.dart' show kReleaseMode;

/// Single source of truth for backend URLs.
///
/// Mirrors `apps/web/lib/config/env.ts` — same precedence, same proxy paths — so
/// both clients switch environments by changing configuration, never code:
///
///   1. `--dart-define=PON_<SERVICE>_URL=...` — one service pointed somewhere of
///      its own. The only way to reach a plain-`http` local stack, since
///      `PON_DOMAIN` always builds `https`/`wss`.
///   2. `--dart-define=PON_DOMAIN=pon.acme.com` — the whole backend behind one
///      host, routed by the reverse proxy (`/api/auth`, `/api/chat`, `/api/ai`,
///      `/api/connector`, `/ws`). One value promotes a build.
///   3. Nothing — a debug build falls back to the local stack on this machine; a
///      **release** build throws.
///
/// That last rule is the point. This file used to fall back to a set of Cloud Run
/// hostnames, so a release build with no `--dart-define` silently talked to
/// production — and once those hosts were retired, silently talked to nothing.
/// A packaging mistake should be loud at the first request, not invisible.
class AppConfig {
  static const String _domain = String.fromEnvironment('PON_DOMAIN');

  /// Per-service overrides, e.g. `--dart-define=PON_CHAT_URL=http://10.0.2.2:8080`.
  /// They win over the proxy domain, individually.
  static const String _localAuth = String.fromEnvironment('PON_AUTH_URL');
  static const String _localChat = String.fromEnvironment('PON_CHAT_URL');
  static const String _localConnector = String.fromEnvironment(
    'PON_CONNECTOR_URL',
  );
  static const String _localAi = String.fromEnvironment('PON_AI_URL');
  static const String _localWs = String.fromEnvironment('PON_WS_URL');

  /// Ports of the local stack (`infra/docker-compose/compose.yml`), used only in
  /// debug builds that were given no configuration at all.
  static const Map<String, String> _debugFallback = {
    'auth': 'http://localhost:3001',
    'chat': 'http://localhost:8080',
    'ai': 'http://localhost:3002',
    'connector': 'http://localhost:3003',
    'ws': 'ws://localhost:8080/ws',
  };

  /// True when a self-host domain was provided at build time.
  static bool get usesProxy => _domain.isNotEmpty;

  /// True when this build was told where its backend is. A release build that
  /// reports false will throw on its first request, by design.
  static bool get configured =>
      usesProxy ||
      (_localAuth.isNotEmpty &&
          _localChat.isNotEmpty &&
          _localAi.isNotEmpty &&
          _localConnector.isNotEmpty);

  static String _resolve(String override, String service, String proxyPath) {
    if (override.isNotEmpty) return override;
    if (usesProxy) return 'https://$_domain$proxyPath';
    if (!kReleaseMode) return _debugFallback[service]!;
    throw StateError(
      'AppConfig: this release build has no backend configured. Build with '
      '--dart-define=PON_DOMAIN=<host>, or with '
      '--dart-define=PON_${service.toUpperCase()}_URL=<url> per service. '
      'See docs/environments.md.',
    );
  }

  static String get authBaseUrl => _resolve(_localAuth, 'auth', '/api/auth');
  static String get chatBaseUrl => _resolve(_localChat, 'chat', '/api/chat');
  static String get connectorBaseUrl =>
      _resolve(_localConnector, 'connector', '/api/connector');

  /// Base URL of the ai-service (:3002). Admin usage/quality dashboard
  /// (`GET /usage/dashboard`) lives here.
  static String get aiBaseUrl => _resolve(_localAi, 'ai', '/api/ai');

  static String get wsUrl {
    if (_localWs.isNotEmpty) return _localWs;
    if (usesProxy) return 'wss://$_domain/ws';
    if (!kReleaseMode) return _debugFallback['ws']!;
    throw StateError(
      'AppConfig: this release build has no backend configured. Build with '
      '--dart-define=PON_DOMAIN=<host> or --dart-define=PON_WS_URL=<url>. '
      'See docs/environments.md.',
    );
  }
}
