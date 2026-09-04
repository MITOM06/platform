import 'package:flutter/foundation.dart' show kReleaseMode;

/// Single source of truth for backend URLs.
///
/// Mirrors `apps/web/lib/config/env.ts` — same proxy paths — so both clients
/// switch environments by changing configuration, never code. Precedence, highest
/// first:
///
///   1. [devHost] — DEV ONLY, resolved at **runtime** by [DevHostDiscovery] so a
///      phone follows the laptop between Wi-Fi networks without a rebuild.
///   2. `--dart-define=PON_<SERVICE>_URL=...` — one service pointed somewhere of
///      its own. The only way to reach a plain-`http` local stack, since
///      `PON_DOMAIN` always builds `https`/`wss`.
///   3. `--dart-define=PON_DOMAIN=pon.acme.com` — the whole backend behind one
///      host, routed by the reverse proxy (`/api/auth`, `/api/chat`, `/api/ai`,
///      `/api/connector`, `/ws`). One value promotes a build.
///   4. Nothing — a debug build falls back to the local stack on this machine; a
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

  /// DEV-ONLY. Host (bare IP or `.local` name, no scheme, no port) of the laptop
  /// running `scripts/dev/up.sh`, resolved at **runtime** by [DevHostDiscovery]
  /// instead of baked in at build time.
  ///
  /// A dart-define carries whatever IP the Mac had when the build ran, which
  /// stops being true the moment you move between Wi-Fi networks — home, the
  /// office, a phone hotspot all hand out different addresses, and the app would
  /// keep dialling the stale one. Resolving on startup means the same installed
  /// build follows the laptop around without a rebuild.
  ///
  /// Set once from `main()` before any Dio instance is constructed — every
  /// `create*Dio` bakes `baseUrl` at construction, so a later change would not
  /// reach the clients already built. Null in production builds.
  static String? _devHost;

  /// Assigns the runtime dev host. Highest precedence of all the layers here.
  static void useDevHost(String? host) {
    _devHost = (host != null && host.isNotEmpty) ? host : null;
  }

  /// The dev host currently in force, if any. Exposed for diagnostics.
  static String? get devHost => _devHost;

  /// Ports the local stack publishes, mirroring `infra/docker-compose/compose.yml`.
  /// Used with [devHost], and as the debug fallback when nothing is configured.
  static const int devAuthPort = 3001;
  static const int devChatPort = 8080;
  static const int devAiPort = 3002;
  static const int devConnectorPort = 3003;

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

  static String _resolve(
    String override,
    String service,
    int devPort,
    String proxyPath,
  ) {
    if (_devHost != null) return 'http://$_devHost:$devPort';
    if (override.isNotEmpty) return override;
    if (usesProxy) return 'https://$_domain$proxyPath';
    if (!kReleaseMode) return 'http://localhost:$devPort';
    throw StateError(
      'AppConfig: this release build has no backend configured. Build with '
      '--dart-define=PON_DOMAIN=<host>, or with '
      '--dart-define=PON_${service.toUpperCase()}_URL=<url> per service. '
      'See docs/environments.md.',
    );
  }

  static String get authBaseUrl =>
      _resolve(_localAuth, 'auth', devAuthPort, '/api/auth');
  static String get chatBaseUrl =>
      _resolve(_localChat, 'chat', devChatPort, '/api/chat');
  static String get connectorBaseUrl =>
      _resolve(_localConnector, 'connector', devConnectorPort, '/api/connector');

  /// Base URL of the ai-service (:3002). Admin usage/quality dashboard
  /// (`GET /usage/dashboard`) lives here.
  static String get aiBaseUrl => _resolve(_localAi, 'ai', devAiPort, '/api/ai');

  static String get wsUrl {
    if (_devHost != null) return 'ws://$_devHost:$devChatPort/ws';
    if (_localWs.isNotEmpty) return _localWs;
    if (usesProxy) return 'wss://$_domain/ws';
    if (!kReleaseMode) return 'ws://localhost:$devChatPort/ws';
    throw StateError(
      'AppConfig: this release build has no backend configured. Build with '
      '--dart-define=PON_DOMAIN=<host> or --dart-define=PON_WS_URL=<url>. '
      'See docs/environments.md.',
    );
  }
}
