// Mirror of web lib/__tests__/media-token.test.ts (cross-platform parity).

import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/core/media/media_token_holder.dart';
import 'package:platform_client/core/media/media_token_provider.dart';

const _h = Duration(hours: 1);

void main() {
  late FakeAsync fake;
  late int calls;
  late Future<({String token, DateTime expiresAt})> Function() next;
  late MediaTokenController c;

  ({String token, DateTime expiresAt}) resp(String t, double hoursLeft) => (
        token: t,
        expiresAt: fake.getClock(DateTime(2026)).now().add(
            Duration(milliseconds: (hoursLeft * _h.inMilliseconds).round())),
      );

  void run(void Function() body) {
    fakeAsync((f) {
      fake = f;
      calls = 0;
      MediaTokenHolder.clear();
      c = MediaTokenController(
        fetch: () {
          calls++;
          return next();
        },
        now: () => f.getClock(DateTime(2026)).now(),
      )..activate();
      body();
      c.clear();
    });
  }

  tearDown(MediaTokenHolder.clear);

  test('refreshes_when_less_than_1h_left', () {
    run(() {
      next = () async => resp('T1', 5);
      c.ensure();
      fake.flushMicrotasks();
      expect(MediaTokenHolder.token, 'T1');
      // still > 1h left: no new call
      c.ensure();
      fake.flushMicrotasks();
      expect(calls, 1);
      // scheduled refresh fires when < 1h remains (after 4h)
      next = () async => resp('T2', 6);
      fake.elapse(const Duration(hours: 4, seconds: 1));
      expect(calls, 2);
      expect(MediaTokenHolder.token, 'T2');
    });
  });

  test('logout_clears_token', () {
    run(() {
      next = () async => resp('T1', 5);
      c.ensure();
      fake.flushMicrotasks();
      expect(MediaTokenHolder.token, 'T1');
      c.clear();
      expect(MediaTokenHolder.token, isNull);
      // signed out: no more fetches, no refresh timer
      fake.elapse(const Duration(hours: 10));
      expect(calls, 1);
    });
  });

  test('keeps_retrying_in_background_after_failure_without_throwing', () {
    run(() {
      next = () async => throw Exception('boom');
      Object? error;
      c.ensure().catchError((Object e) => error = e);
      fake.flushMicrotasks();
      expect(error, isNull);
      expect(MediaTokenHolder.token, isNull);
      next = () async => resp('T1', 5);
      fake.elapse(const Duration(seconds: 16));
      expect(MediaTokenHolder.token, 'T1');
    });
  });

  test('relogin_during_inflight_request_does_not_store_previous_users_token',
      () {
    run(() {
      final a = Completer<({String token, DateTime expiresAt})>();
      next = () => a.future;
      c.ensure(); // user A in flight
      c.clear(); // sign out
      c.activate(); // user B signs in
      next = () async => resp('TB', 5);
      c.ensure();
      fake.flushMicrotasks();
      a.complete(resp('TA', 5)); // A's late response
      fake.flushMicrotasks();
      expect(MediaTokenHolder.token, 'TB');
      expect(calls, 2);
    });
  });

  test('retry_backs_off_to_5_minutes_and_resets_after_success', () {
    run(() {
      next = () async => throw Exception('boom');
      c.ensure();
      fake.flushMicrotasks();
      expect(calls, 1);
      const steps = [
        [15, 2], [30, 3], [60, 4], [120, 5], [240, 6], [300, 7], [300, 8],
      ];
      for (final s in steps) {
        fake.elapse(Duration(seconds: s[0]) - const Duration(milliseconds: 1));
        expect(calls, s[1] - 1);
        fake.elapse(const Duration(milliseconds: 1));
        expect(calls, s[1]);
      }
      // success resets the delay
      next = () async => resp('T1', 0.5);
      fake.elapse(const Duration(minutes: 5));
      expect(MediaTokenHolder.token, 'T1');
      next = () async => throw Exception('boom');
      fake.elapse(const Duration(seconds: 60)); // refresh (min 60s) -> fails
      final n = calls;
      fake.elapse(const Duration(seconds: 15));
      expect(calls, n + 1);
    });
  });

  test('single_inflight_request_is_shared', () {
    run(() {
      next = () async => resp('T1', 5);
      c.ensure();
      c.ensure();
      fake.flushMicrotasks();
      expect(calls, 1);
    });
  });

  test('ensure_bounded_returns_after_limit_when_request_hangs', () {
    run(() {
      next = () => Future.delayed(const Duration(minutes: 1), () => resp('T', 5));
      var done = false;
      c.ensureBounded().then((_) => done = true);
      fake.elapse(const Duration(seconds: 4));
      expect(done, isFalse);
      fake.elapse(const Duration(seconds: 1));
      expect(done, isTrue);
    });
  });

  test('ensure_bounded_never_throws_on_failure', () {
    run(() {
      next = () async => throw Exception('boom');
      var done = false;
      c.ensureBounded().then((_) => done = true);
      fake.flushMicrotasks();
      expect(done, isTrue);
    });
  });

  test('not_signed_in_does_not_fetch', () {
    run(() {
      c.clear(); // deactivates
      next = () async => resp('T1', 5);
      c.ensure();
      fake.flushMicrotasks();
      expect(calls, 0);
      expect(MediaTokenHolder.token, isNull);
    });
  });

  test('fetcher_throwing_synchronously_never_throws_and_retries', () {
    run(() {
      next = () => throw StateError('sync boom');
      Object? error;
      c.ensure().catchError((Object e) => error = e);
      c.ensureBounded().catchError((Object e) => error = e);
      fake.flushMicrotasks();
      expect(error, isNull);
      expect(calls, 1);
      next = () async => resp('T1', 5);
      fake.elapse(const Duration(seconds: 16));
      expect(MediaTokenHolder.token, 'T1');
    });
  });

  // The call didChangeAppLifecycleState(resumed) makes (main.dart): the widget
  // hook itself needs the whole app (Firebase, router) and is not unit-tested.
  test('resume_ensure_refetches_stale_token_and_skips_fresh', () {
    run(() {
      next = () async => resp('T1', 0.5); // < 1h left
      c.ensure();
      fake.flushMicrotasks();
      expect(calls, 1);
      next = () async => resp('T2', 5);
      c.ensure(); // app resumed
      fake.flushMicrotasks();
      expect(calls, 2);
      expect(MediaTokenHolder.token, 'T2');
      c.ensure(); // resumed again, token fresh
      fake.flushMicrotasks();
      expect(calls, 2);
    });
  });

  test('epoch_bumps_once_on_null_to_value_and_not_on_refresh', () {
    run(() {
      final start = MediaTokenHolder.epoch.value;
      next = () async => resp('T1', 5);
      c.ensure();
      fake.flushMicrotasks();
      expect(MediaTokenHolder.epoch.value, start + 1);
      // scheduled refresh (value -> value): same epoch
      next = () async => resp('T2', 6);
      fake.elapse(const Duration(hours: 4, seconds: 1));
      expect(MediaTokenHolder.token, 'T2');
      expect(MediaTokenHolder.epoch.value, start + 1);
    });
  });
}
