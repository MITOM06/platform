import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/config/app_config.dart';

/// These run without any `--dart-define`, which is the "nothing configured"
/// case. In a debug/test binary that must resolve to the local stack; the
/// release binary throws instead (see AppConfig) so a build packaged without
/// configuration fails loudly rather than dialling a stale host.
void main() {
  group('AppConfig with no --dart-define', () {
    test('reports itself unconfigured', () {
      expect(AppConfig.usesProxy, isFalse);
      expect(AppConfig.configured, isFalse);
    });

    test('falls back to the local stack, never to a deployed host', () {
      for (final url in [
        AppConfig.authBaseUrl,
        AppConfig.chatBaseUrl,
        AppConfig.aiBaseUrl,
        AppConfig.connectorBaseUrl,
        AppConfig.wsUrl,
      ]) {
        expect(url, contains('localhost'), reason: '$url must stay local');
      }
    });

    test('maps each service to the port compose.yml publishes', () {
      expect(AppConfig.authBaseUrl, 'http://localhost:3001');
      expect(AppConfig.chatBaseUrl, 'http://localhost:8080');
      expect(AppConfig.aiBaseUrl, 'http://localhost:3002');
      expect(AppConfig.connectorBaseUrl, 'http://localhost:3003');
      expect(AppConfig.wsUrl, 'ws://localhost:8080/ws');
    });
  });
}
