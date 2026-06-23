/// Single source of truth for backend URLs.
///
/// Self-host: pass `--dart-define=PON_DOMAIN=pon.acme.com` at build time and
/// every service routes through the company's single domain via the reverse
/// proxy. When PON_DOMAIN is empty (the default), the app targets the existing
/// Google Cloud Run deployment — so existing builds are unchanged.
class AppConfig {
  static const String _domain = String.fromEnvironment('PON_DOMAIN');

  /// True when a self-host domain was provided at build time.
  static bool get usesProxy => _domain.isNotEmpty;

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

  static String get authBaseUrl =>
      usesProxy ? 'https://$_domain/api/auth' : _cloudAuth;
  static String get chatBaseUrl =>
      usesProxy ? 'https://$_domain/api/chat' : _cloudChat;
  static String get connectorBaseUrl =>
      usesProxy ? 'https://$_domain/api/connector' : _cloudConnector;

  /// Base URL of the ai-service (:3002). Admin usage/quality dashboard
  /// (`GET /usage/dashboard`) lives here. Self-host routes via `/api/ai`.
  static String get aiBaseUrl =>
      usesProxy ? 'https://$_domain/api/ai' : _cloudAi;
  static String get wsUrl => usesProxy ? 'wss://$_domain/ws' : _cloudWs;
}
