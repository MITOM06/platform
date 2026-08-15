/// Single source of truth for backend URLs.
///
/// Self-host: pass `--dart-define=PON_DOMAIN=pon.acme.com` at build time and
/// every service routes through the company's single domain via the reverse
/// proxy. When PON_DOMAIN is empty (the default), the app targets the existing
/// Google Cloud Run deployment — so existing builds are unchanged.
class AppConfig {
  static const String _domain = String.fromEnvironment('PON_DOMAIN');

  /// Per-service overrides for local development, e.g.
  /// `--dart-define=PON_CHAT_URL=http://localhost:8080`. They win over both the
  /// proxy domain and the Cloud Run defaults, and are the only way to reach a
  /// plain-`http` localhost stack (`PON_DOMAIN` always builds `https`/`wss`).
  /// Empty (the default) leaves the deployed behaviour untouched.
  static const String _localAuth = String.fromEnvironment('PON_AUTH_URL');
  static const String _localChat = String.fromEnvironment('PON_CHAT_URL');
  static const String _localConnector = String.fromEnvironment(
    'PON_CONNECTOR_URL',
  );
  static const String _localAi = String.fromEnvironment('PON_AI_URL');
  static const String _localWs = String.fromEnvironment('PON_WS_URL');

  /// True when a self-host domain was provided at build time.
  static bool get usesProxy => _domain.isNotEmpty;

  /// DEV-ONLY. Host (bare IP or `.local` name, no scheme, no port) of the
  /// laptop running `scripts/dev/up.sh`, resolved at **runtime** by
  /// [DevHostDiscovery] instead of baked in at build time.
  ///
  /// A dart-define carries whatever IP the Mac had when the build ran, which
  /// stops being true the moment you move between Wi-Fi networks — home, the
  /// office, a phone hotspot all hand out different addresses, and the app
  /// would keep dialling the stale one. Resolving on startup means the same
  /// installed build follows the laptop around without a rebuild.
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

  static const String _cloudAuth =
      'https://auth-service-942942821810.asia-southeast1.run.app';
  static const String _cloudChat =
      'https://chat-service-942942821810.asia-southeast1.run.app';
  static const String _cloudConnector =
      'https://connector-service-942942821810.asia-southeast1.run.app';
  static const String _cloudAi =
      'https://ai-service-942942821810.asia-southeast1.run.app';
  static const String _cloudWs =
      'wss://chat-service-942942821810.asia-southeast1.run.app/ws';

  /// Ports the local stack publishes, mirroring `infra/docker-compose/compose.yml`.
  /// Only meaningful alongside [_devHost].
  static const int devAuthPort = 3001;
  static const int devChatPort = 8080;
  static const int devAiPort = 3002;
  static const int devConnectorPort = 3003;

  static String get authBaseUrl => _devHost != null
      ? 'http://$_devHost:$devAuthPort'
      : (_localAuth.isNotEmpty
            ? _localAuth
            : (usesProxy ? 'https://$_domain/api/auth' : _cloudAuth));
  static String get chatBaseUrl => _devHost != null
      ? 'http://$_devHost:$devChatPort'
      : (_localChat.isNotEmpty
            ? _localChat
            : (usesProxy ? 'https://$_domain/api/chat' : _cloudChat));
  static String get connectorBaseUrl => _devHost != null
      ? 'http://$_devHost:$devConnectorPort'
      : (_localConnector.isNotEmpty
            ? _localConnector
            : (usesProxy ? 'https://$_domain/api/connector' : _cloudConnector));

  /// Base URL of the ai-service (:3002). Admin usage/quality dashboard
  /// (`GET /usage/dashboard`) lives here. Self-host routes via `/api/ai`.
  static String get aiBaseUrl => _devHost != null
      ? 'http://$_devHost:$devAiPort'
      : (_localAi.isNotEmpty
            ? _localAi
            : (usesProxy ? 'https://$_domain/api/ai' : _cloudAi));
  static String get wsUrl => _devHost != null
      ? 'ws://$_devHost:$devChatPort/ws'
      : (_localWs.isNotEmpty
            ? _localWs
            : (usesProxy ? 'wss://$_domain/ws' : _cloudWs));
}
