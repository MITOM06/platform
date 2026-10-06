import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/calls_repository.dart';

export '../data/calls_repository.dart' show CallTransport;

/// Which media path a NEW outgoing call takes. Incoming calls carry their own
/// `transport` on the ring. Read synchronously when the user taps Call and
/// refreshed in the background on every STOMP (re)connect. Anything
/// unexpected falls back to mesh — the path that needs no media server.
class CallTransportCache {
  CallTransport _current = CallTransport.mesh;

  CallTransport get current => _current;

  Future<void> refresh(CallsApi api) async {
    try {
      _current = (await api.getConfig()).transport;
    } catch (_) {
      _current = CallTransport.mesh;
    }
  }
}

final callTransportProvider =
    Provider<CallTransportCache>((ref) => CallTransportCache());
