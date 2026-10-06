import 'package:flutter/foundation.dart';
import 'package:stomp_dart_client/stomp_dart_client.dart';

/// Subscribes [destination] on the CURRENT socket and returns its unsubscribe
/// handle. Throws when no socket is available.
typedef StompSubscriber = StompUnsubscribe Function(
  String destination,
  StompFrameCallback callback,
);

/// Tracks the STOMP subscriptions the app WANTS separately from the ones that
/// are ACTIVE on the current socket.
///
/// The bug this exists for: subscription handles used to be dropped only on a
/// client-initiated DISCONNECT (`onDisconnect`), but a dropped socket (network
/// loss, server restart, Cloud Run timeout) only fires `onWebSocketDone`. The
/// stale handles survived, `_doSubscribe…` saw "already subscribed" on the new
/// socket and skipped every subscription — no messages, notifications or calls
/// until the app was restarted, while `isConnected` reported true (which also
/// silenced the foreground FCM fallback).
///
/// Rules:
/// - [onConnected] is called for EVERY (re)connect: all previous handles belong
///   to a dead socket, so they are forgotten and every desired destination is
///   subscribed again.
/// - [onSocketLost] forgets the handles but keeps the desired set.
/// - [clear] (logout) forgets everything.
class StompSubscriptionRegistry {
  final Map<String, ({String destination, StompFrameCallback callback})>
      _desired = {};
  final Map<String, StompUnsubscribe> _active = {};

  /// Keys that should be subscribed whenever a socket is up.
  Set<String> get desiredKeys => _desired.keys.toSet();

  /// Keys subscribed on the current socket.
  Set<String> get activeKeys => _active.keys.toSet();

  bool isDesired(String key) => _desired.containsKey(key);
  bool isActive(String key) => _active.containsKey(key);

  /// Registers [key] → [destination]. Subscribes immediately when a
  /// [subscriber] is supplied (socket connected); otherwise the next
  /// [onConnected] picks it up.
  void add(
    String key,
    String destination,
    StompFrameCallback callback, {
    StompSubscriber? subscriber,
  }) {
    _desired[key] = (destination: destination, callback: callback);
    if (subscriber != null) _subscribeOne(key, subscriber);
  }

  /// Stops wanting [key] and unsubscribes it from the current socket when
  /// [connected] (an UNSUBSCRIBE frame on a dead socket would throw).
  void remove(String key, {required bool connected}) {
    _desired.remove(key);
    final unsub = _active.remove(key);
    if (unsub != null && connected) {
      try {
        unsub();
      } catch (e) {
        debugPrint('[STOMP] unsubscribe $key failed: $e');
      }
    }
  }

  /// A fresh socket is up: drop every old handle and subscribe all desired
  /// destinations on it.
  void onConnected(StompSubscriber subscriber) {
    _active.clear();
    for (final key in _desired.keys.toList()) {
      _subscribeOne(key, subscriber);
    }
  }

  /// The socket is gone (dropped, errored or deactivated).
  void onSocketLost() => _active.clear();

  /// Logout: forget the desired set too so the next account starts clean.
  void clear() {
    _desired.clear();
    _active.clear();
  }

  void _subscribeOne(String key, StompSubscriber subscriber) {
    if (_active.containsKey(key)) return;
    final spec = _desired[key];
    if (spec == null) return;
    try {
      _active[key] = subscriber(spec.destination, spec.callback);
    } catch (e) {
      // No socket (or it closed between the check and the call) — the next
      // onConnected retries.
      debugPrint('[STOMP] subscribe ${spec.destination} failed: $e');
    }
  }
}
