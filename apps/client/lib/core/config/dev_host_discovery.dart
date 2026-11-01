import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_config.dart';

/// Signature of a single reachability check, injectable so the ordering and
/// sweep logic can be unit-tested without a live stack.
typedef HostProbe = Future<bool> Function(String host);

/// Signature of "which IPv4 addresses does this device hold", likewise
/// injectable — a test runner has no LAN interface worth sweeping.
typedef LocalAddressLookup = Future<List<String>> Function();

/// DEV-ONLY. Finds the laptop running `scripts/dev/up.sh` on whatever network
/// the phone is on right now.
///
/// The problem this exists for: a `--dart-define` freezes the Mac's IP at build
/// time, but that address is a DHCP lease. Home, office and a phone hotspot all
/// hand out different subnets (this repo has watched a session move from
/// `192.168.34.x` to `172.20.10.x` mid-afternoon), so a build made at one desk
/// dials a dead address at the next one and the app looks like a broken
/// backend. Resolving on startup lets one installed build follow the laptop
/// around with no rebuild and no manual edit.
///
/// Strategy, cheapest first — the first host that answers wins:
///   1. the host that worked last time (persisted; instant when you haven't moved)
///   2. [_hintHost], the IP the Mac had at build time
///   3. [_mdnsHost], the Mac's Bonjour name — survives DHCP changes entirely,
///      but only iOS resolves `.local` natively, so it is a bonus not a plan
///   4. a sweep of the phone's own /24, which needs no prior knowledge at all
///
/// Entirely inert unless `--dart-define=PON_DEV_DISCOVERY=true`, so production
/// builds never probe anything. Lives on `dev` per
/// `.claude/rules/dev-local-only.md` and must not be merged to main.
class DevHostDiscovery {
  DevHostDiscovery._();

  /// Master switch. Without it every entry point below returns null immediately.
  static const bool enabled = bool.fromEnvironment('PON_DEV_DISCOVERY');

  /// The Mac's LAN IP as seen at build time by `scripts/dev/up.sh`. A hint, not
  /// a promise — it goes stale exactly when you change networks.
  static const String _hintHost = String.fromEnvironment('PON_DEV_HOST');

  /// The Mac's Bonjour name, e.g. `Phongs-MacBook-Air.local`.
  static const String _mdnsHost = String.fromEnvironment('PON_DEV_MDNS');

  /// Where the winning host is remembered between launches.
  static const String prefsKey = 'dev_host';

  /// Generous enough for a sleepy Wi-Fi link on the three known candidates.
  static const Duration fastProbeTimeout = Duration(milliseconds: 1500);

  /// Tight, because the sweep pays it 254 times over.
  static const Duration sweepProbeTimeout = Duration(milliseconds: 700);

  /// Sockets in flight during a sweep. High enough to cross a /24 in a couple
  /// of rounds, low enough not to exhaust the file-descriptor budget on iOS.
  static const int sweepConcurrency = 48;

  /// Resolves the dev host and installs it into [AppConfig].
  ///
  /// Call from `main()` **before** the first Dio instance exists — `DioClient`
  /// bakes `baseUrl` at construction, so a host discovered later would not
  /// reach clients already built.
  ///
  /// Returns the host that won, or null when discovery is disabled or nothing
  /// answered (in which case [AppConfig] keeps its build-time behaviour and the
  /// app talks to whatever it was compiled against).
  static Future<String?> resolveAndApply({
    required SharedPreferences prefs,
    HostProbe? probe,
    LocalAddressLookup? localAddresses,
  }) async {
    if (!enabled) return null;

    final stopwatch = Stopwatch()..start();
    final host = await resolveHost(
      knownHosts: _fastCandidates(prefs),
      // The two phases get different budgets: the sweep pays its timeout up to
      // 254 times, the three known candidates pay it once. A test injecting a
      // probe drives both phases with it.
      fastProbe: probe ?? _probeWith(fastProbeTimeout),
      sweepProbe: probe ?? _probeWith(sweepProbeTimeout),
      localAddresses: localAddresses ?? _ownIpv4Addresses,
    );
    stopwatch.stop();

    if (host == null) {
      debugPrint(
        '[dev-host] no local stack found in ${stopwatch.elapsedMilliseconds}ms '
        '— falling back to the build-time configuration',
      );
      return null;
    }

    AppConfig.useDevHost(host);
    await prefs.setString(prefsKey, host);
    debugPrint(
      '[dev-host] using $host (found in ${stopwatch.elapsedMilliseconds}ms)',
    );
    return host;
  }

  /// The search itself, free of dart-defines, prefs and sockets so it can be
  /// driven from a test: try [knownHosts] in order, then fall back to sweeping
  /// whatever subnets [localAddresses] reports.
  ///
  /// Deliberately not gated on [enabled] — `flutter test` compiles without the
  /// dart-define, so gating here would make every test a no-op.
  @visibleForTesting
  static Future<String?> resolveHost({
    required List<String> knownHosts,
    required HostProbe fastProbe,
    required HostProbe sweepProbe,
    required LocalAddressLookup localAddresses,
  }) async {
    for (final candidate in knownHosts) {
      if (await fastProbe(candidate)) return candidate;
    }
    return _sweep(probe: sweepProbe, localAddresses: localAddresses);
  }

  static List<String> _fastCandidates(SharedPreferences prefs) =>
      orderedCandidates(
        persisted: prefs.getString(prefsKey),
        hint: _hintHost,
        mdns: _mdnsHost,
      );

  /// Known-address candidates in cheapest-first order, dropping blanks and
  /// de-duplicating so a persisted host equal to the build-time hint does not
  /// cost two probes.
  @visibleForTesting
  static List<String> orderedCandidates({
    String? persisted,
    String hint = '',
    String mdns = '',
  }) {
    final seen = <String>{};
    return [persisted ?? '', hint, mdns]
        .where((h) => h.isNotEmpty && seen.add(h))
        .toList();
  }

  /// Walks every /24 this device sits on looking for the stack.
  ///
  /// This is the branch that makes the feature work somewhere it has never been
  /// before: the phone's own address tells us the subnet, and the Mac is by
  /// definition on it. Runs last because it is the only expensive step.
  static Future<String?> _sweep({
    required HostProbe probe,
    required LocalAddressLookup localAddresses,
  }) async {
    for (final own in await localAddresses()) {
      final octets = own.split('.');
      if (octets.length != 4) continue;
      final prefix = '${octets[0]}.${octets[1]}.${octets[2]}.';

      final candidates = [
        for (var host = 1; host <= 254; host++) '$prefix$host',
      ]..remove(own);

      for (var i = 0; i < candidates.length; i += sweepConcurrency) {
        final batch = candidates.skip(i).take(sweepConcurrency).toList();
        final results = await Future.wait(batch.map(probe));
        // Lowest address first, so a rerun on an unchanged network keeps
        // picking the same machine when several are running the stack.
        final hit = results.indexOf(true);
        if (hit != -1) return batch[hit];
      }
    }
    return null;
  }

  /// The device's own non-loopback IPv4 addresses.
  ///
  /// Link-local (169.254/16) is skipped: it means DHCP never completed, so
  /// there is no shared subnet with the Mac to sweep.
  static Future<List<String>> _ownIpv4Addresses() async {
    try {
      final interfaces = await NetworkInterface.list(
        type: InternetAddressType.IPv4,
        includeLoopback: false,
        includeLinkLocal: false,
      );
      return [
        for (final interface in interfaces)
          for (final addr in interface.addresses)
            if (!addr.isLoopback && !addr.address.startsWith('169.254.'))
              addr.address,
      ];
    } on Object catch (e) {
      debugPrint('[dev-host] could not enumerate interfaces: $e');
      return const [];
    }
  }

  /// Reachability check: does an ai-service answer 200 on this host?
  ///
  /// Port 3002 rather than the chat-service's 8080 deliberately — 8080 is
  /// crowded on a typical LAN (routers, other dev servers) and a stray 200
  /// there would point the whole app at the wrong machine. A `/health` 200 on
  /// 3002 is a far more specific signal, and the compose file always brings
  /// ai-service up alongside the rest of the stack.
  static HostProbe _probeWith(Duration timeout) =>
      (host) => _httpProbe(host, timeout);

  static Future<bool> _httpProbe(String host, Duration timeout) async {
    final client = HttpClient()..connectionTimeout = timeout;
    try {
      final uri = Uri.parse('http://$host:${AppConfig.devAiPort}/health');
      final response = await client
          .getUrl(uri)
          .then((req) => req.close())
          .timeout(timeout);
      await response.drain<void>();
      return response.statusCode == 200;
    } on Object {
      // Refused, unroutable, timed out, DNS miss for a `.local` name on
      // Android — all just mean "not here", never worth surfacing.
      return false;
    } finally {
      client.close(force: true);
    }
  }
}
