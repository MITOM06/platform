import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/config/app_config.dart';
import 'package:platform_client/core/config/dev_host_discovery.dart';

/// Records every host probed so the tests can assert on ordering and on the
/// probes that were *not* made — the cost of this feature is measured in
/// round-trips, so "didn't probe twice" is part of the contract.
class _FakeProbe {
  _FakeProbe(this.reachable);

  final Set<String> reachable;
  final List<String> probed = [];

  Future<bool> call(String host) async {
    probed.add(host);
    return reachable.contains(host);
  }
}

void main() {
  tearDown(() => AppConfig.useDevHost(null));

  group('orderedCandidates', () {
    test('puts the last-known-good host first', () {
      expect(
        DevHostDiscovery.orderedCandidates(
          persisted: '10.0.0.9',
          hint: '192.168.1.5',
          mdns: 'mac.local',
        ),
        ['10.0.0.9', '192.168.1.5', 'mac.local'],
      );
    });

    test('drops blanks so an unset dart-define costs no probe', () {
      expect(
        DevHostDiscovery.orderedCandidates(persisted: null, hint: '', mdns: ''),
        isEmpty,
      );
    });

    test('de-duplicates a persisted host equal to the build-time hint', () {
      expect(
        DevHostDiscovery.orderedCandidates(
          persisted: '192.168.1.5',
          hint: '192.168.1.5',
          mdns: 'mac.local',
        ),
        ['192.168.1.5', 'mac.local'],
      );
    });
  });

  group('resolveHost — known candidates', () {
    test('returns the first host that answers and stops probing', () async {
      final probe = _FakeProbe({'192.168.1.5', 'mac.local'});

      final host = await DevHostDiscovery.resolveHost(
        knownHosts: ['10.0.0.9', '192.168.1.5', 'mac.local'],
        fastProbe: probe.call,
        sweepProbe: probe.call,
        localAddresses: () async => [],
      );

      expect(host, '192.168.1.5');
      expect(probe.probed, ['10.0.0.9', '192.168.1.5']);
    });

    test('falls through to the sweep when every known host is stale', () async {
      // The scenario this feature exists for: yesterday's IP and the build-time
      // hint both point at a network you have since left.
      final probe = _FakeProbe({'172.20.10.3'});

      final host = await DevHostDiscovery.resolveHost(
        knownHosts: ['192.168.34.126', '192.168.1.5'],
        fastProbe: probe.call,
        sweepProbe: probe.call,
        localAddresses: () async => ['172.20.10.7'],
      );

      expect(host, '172.20.10.3');
    });
  });

  group('resolveHost — subnet sweep', () {
    test('finds the stack on a network it has never seen', () async {
      final probe = _FakeProbe({'172.20.10.1'});

      final host = await DevHostDiscovery.resolveHost(
        knownHosts: const [],
        fastProbe: probe.call,
        sweepProbe: probe.call,
        localAddresses: () async => ['172.20.10.7'],
      );

      expect(host, '172.20.10.1');
    });

    test('never probes the device itself', () async {
      final probe = _FakeProbe(const {});

      await DevHostDiscovery.resolveHost(
        knownHosts: const [],
        fastProbe: probe.call,
        sweepProbe: probe.call,
        localAddresses: () async => ['192.168.1.50'],
      );

      expect(probe.probed, isNot(contains('192.168.1.50')));
      expect(probe.probed, hasLength(253));
    });

    test('prefers the lowest address when several machines answer', () async {
      // Two laptops running the stack on one office network must not make the
      // choice depend on which socket happened to return first.
      final probe = _FakeProbe({'192.168.1.80', '192.168.1.20'});

      final host = await DevHostDiscovery.resolveHost(
        knownHosts: const [],
        fastProbe: probe.call,
        sweepProbe: probe.call,
        localAddresses: () async => ['192.168.1.99'],
      );

      expect(host, '192.168.1.20');
    });

    test('sweeps every subnet the device is on', () async {
      // Wi-Fi plus a USB/hotspot interface: the Mac may be on either one.
      final probe = _FakeProbe({'172.20.10.4'});

      final host = await DevHostDiscovery.resolveHost(
        knownHosts: const [],
        fastProbe: probe.call,
        sweepProbe: probe.call,
        localAddresses: () async => ['192.168.1.50', '172.20.10.9'],
      );

      expect(host, '172.20.10.4');
    });

    test('returns null when nothing answers anywhere', () async {
      final probe = _FakeProbe(const {});

      final host = await DevHostDiscovery.resolveHost(
        knownHosts: ['192.168.1.5'],
        fastProbe: probe.call,
        sweepProbe: probe.call,
        localAddresses: () async => ['192.168.1.50'],
      );

      expect(host, isNull);
    });

    test('skips a malformed address instead of throwing', () async {
      final probe = _FakeProbe(const {});

      final host = await DevHostDiscovery.resolveHost(
        knownHosts: const [],
        fastProbe: probe.call,
        sweepProbe: probe.call,
        localAddresses: () async => ['not-an-ip'],
      );

      expect(host, isNull);
      expect(probe.probed, isEmpty);
    });
  });

  group('AppConfig dev host override', () {
    test('rewrites every service URL onto the discovered host', () {
      AppConfig.useDevHost('172.20.10.3');

      expect(AppConfig.authBaseUrl, 'http://172.20.10.3:3001');
      expect(AppConfig.chatBaseUrl, 'http://172.20.10.3:8080');
      expect(AppConfig.aiBaseUrl, 'http://172.20.10.3:3002');
      expect(AppConfig.connectorBaseUrl, 'http://172.20.10.3:3003');
      expect(AppConfig.wsUrl, 'ws://172.20.10.3:8080/ws');
    });

    test('clearing it restores the build-time Cloud Run defaults', () {
      AppConfig.useDevHost('172.20.10.3');
      AppConfig.useDevHost(null);

      expect(AppConfig.devHost, isNull);
      expect(AppConfig.authBaseUrl, startsWith('https://'));
      expect(AppConfig.chatBaseUrl, contains('run.app'));
      expect(AppConfig.wsUrl, startsWith('wss://'));
    });

    test('an empty host is treated as no override, not as a blank URL', () {
      AppConfig.useDevHost('');

      expect(AppConfig.devHost, isNull);
      expect(AppConfig.authBaseUrl, startsWith('https://'));
    });
  });
}
