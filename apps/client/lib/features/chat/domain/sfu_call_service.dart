import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import '../../../core/rtc/livekit_session.dart';
import '../../../core/rtc/rtc_session.dart';
import '../data/calls_repository.dart';
import '../data/stomp_service.dart';
import 'call_network.dart';
import 'call_rules.dart';
import 'call_signal_port.dart';
import 'call_transport.dart';
import 'direct_call_engine.dart';

export 'call_signal_port.dart';

part 'sfu_call_service_signals.dart';

const _declineReasons = {
  CallEndReason.declined,
  CallEndReason.busy,
  CallEndReason.mediaError
};

/// 1-on-1 calls through LiveKit (server `CALL_TRANSPORT=sfu`). Same UX as
/// [WebRTCService] — ringback, end reasons, call log — but the server rings
/// and LiveKit carries the media. Mirrors web `lib/webrtc/sfu-call.ts`.
class SfuCallService implements DirectCallEngine {
  final CallSignalPort _port;
  final CallsApi _api;
  final CallTransportCache _transport;
  final RtcSessionFactory _sessionFactory;
  final Future<bool> Function(bool video) _probeMedia;
  final Duration _peerGrace;

  /// How long a hang-up before `call.started` waits for that id to cancel it.
  final Duration _pendingStartDeadline;
  Timer? _pendingTimer;

  SfuCallService({
    required CallSignalPort port,
    required CallsApi api,
    required CallTransportCache transport,
    required RtcSessionFactory sessionFactory,
    required Future<bool> Function(bool video) probeMedia,
    Duration peerGrace = ReconnectWatch.reconnectGrace,
    Duration pendingStartDeadline = const Duration(seconds: 15),
  })  : _port = port,
        _api = api,
        _transport = transport,
        _sessionFactory = sessionFactory,
        _probeMedia = probeMedia,
        _peerGrace = peerGrace,
        _pendingStartDeadline = pendingStartDeadline;

  @override
  Function(MediaStream)? onLocalStream;
  @override
  Function(MediaStream)? onRemoteStream;
  @override
  Function()? onCallEnded;
  @override
  void Function(CallEndReason reason, bool byPeer)? onEndNotice;
  @override
  Function(String content)? onSendCallLog;

  /// Shown under the call status: LiveKit is re-establishing the connection.
  final ValueNotifier<bool> reconnecting = ValueNotifier(false);

  /// Shown under the call status: our own connection is poor.
  final ValueNotifier<bool> poorConnection = ValueNotifier(false);

  RtcSession? _session;
  StreamSubscription<Map<String, dynamic>>? _eventsSub;
  String? _heldConversation;
  String? _targetId;
  String? _conversationId;
  String? _callId;
  bool _isVideo = false;
  bool _incoming = false;
  bool _accepting = false;
  bool _probing = false;
  bool _connected = false;
  bool _pendingStart = false;
  CallEndReason? _cancelledBeforeStart;
  MediaStream? _lastRemote;
  /// Whose network is weak, the other person's camera, the reconnect window.
  @override
  final CallNetworkState network = CallNetworkState();

  /// Someone dropped: the one-minute "waiting to reconnect" window.
  late final ReconnectWatch _watch = ReconnectWatch(network, grace: _peerGrace);

  /// A rejoin of the room is in flight.
  bool _rejoining = false;
  DateTime? _mediaSince;
  bool _micOn = true;
  bool _cameraOn = true;
  bool _speakerOn = false;

  /// A LiveKit 1-on-1 is starting, ringing out, or running.
  bool get isActive =>
      _callId != null || (_pendingStart && _cancelledBeforeStart == null);

  @override
  bool get isVideo => _isVideo;

  /// Our own outgoing, unanswered call is ringing [peerId] in [conversationId].
  bool isCallingTo(String peerId, String conversationId) =>
      !_incoming &&
      !_connected &&
      _targetId == peerId &&
      _conversationId == conversationId &&
      (_callId != null || (_pendingStart && _cancelledBeforeStart == null));

  @override
  bool get micOn => _micOn;
  @override
  bool get cameraOn => _cameraOn;
  @override
  bool get speakerOn => _speakerOn;

  /// Caller: ask the server to ring [targetId]; the room is joined once the
  /// server answers with `call.started` (carrying the call id).
  Future<void> startOutgoing({
    required String targetId,
    required String conversationId,
    required bool isVideo,
  }) async {
    _reset(
        targetId: targetId, conversationId: conversationId, isVideo: isVideo);
    _incoming = false;
    _pendingStart = true;
    _hold(conversationId);
    _port.send('/app/call.start', {
      'conversationId': conversationId,
      'media': isVideo ? 'video' : 'audio',
      'merge': true, // we can join a call-merged call (both tapped Call)
    });
  }

  /// Callee: the call screen opened for a ring the user tapped Answer on.
  void prepareIncoming({
    required String targetId,
    required String conversationId,
    required String callId,
    required bool isVideo,
  }) {
    _reset(
        targetId: targetId, conversationId: conversationId, isVideo: isVideo);
    _incoming = true;
    _callId = callId;
    _hold(conversationId);
  }

  /// Callee: check the mic/camera, then answer and join. A refused permission
  /// is sent as a decline BEFORE answering — after an answer the server no
  /// longer takes a decline.
  Future<void> answer() async {
    final callId = _callId;
    if (callId == null || !_incoming || _accepting || _probing) return;
    _probing = true;
    final ok = await _probeMedia(_isVideo);
    _probing = false;
    if (_callId != callId) return; // the caller gave up meanwhile
    if (!ok) {
      await endCall(reason: CallEndReason.mediaError);
      return;
    }
    _accepting = true;
    _port.send('/app/call.accept', {'callId': callId});
    await _join();
  }

  @override
  Future<void> endCall(
      {int? duration, CallEndReason reason = CallEndReason.hangup}) async {
    final callId = _callId;
    final secs = duration ??
        (_mediaSince == null
            ? 0
            : DateTime.now().difference(_mediaSince!).inSeconds);
    var keepPending = false;
    if (_incoming && !_accepting) {
      if (callId != null) {
        final why =
            _declineReasons.contains(reason) ? reason : CallEndReason.declined;
        _port.send('/app/call.decline', {'callId': callId, 'reason': why.wire});
      }
      onSendCallLog?.call(WebRTCServiceLogs.missed(_isVideo));
    } else if (!_incoming && !_connected) {
      if (callId != null) {
        final why = reason == CallEndReason.noAnswer ? 'no_answer' : 'hangup';
        _port.send('/app/call.cancel', {'callId': callId, 'reason': why});
        // The callee may have answered a moment ago — the server then refuses
        // the cancel and only a leave ends the call. A no-op otherwise.
        _port.send('/app/call.leave', {'callId': callId});
        onSendCallLog?.call(WebRTCServiceLogs.missed(_isVideo));
      } else if (_pendingStart) {
        _cancelledBeforeStart = reason; // the callee never rang: nothing to log
        keepPending = true;
        // A call.start lost on a dropping socket never answers: stop waiting.
        _pendingTimer?.cancel();
        _pendingTimer = Timer(_pendingStartDeadline, () {
          _pendingTimer = null;
          _pendingStart = false;
          _cancelledBeforeStart = null;
          _release();
        });
      }
    } else if (callId != null) {
      _port.send('/app/call.leave', {'callId': callId});
      onSendCallLog?.call(_connected
          ? 'system.call.ended:${_isVideo ? 'video' : 'voice'}:$secs'
          : WebRTCServiceLogs.missed(_isVideo));
    }
    onEndNotice?.call(reason, false);
    _teardown(keepPending: keepPending);
  }

  @override
  void failLocally(CallEndReason reason) {
    onEndNotice?.call(reason, false);
    dispose();
  }

  @override
  Future<void> setMicOn(bool on) async {
    _micOn = on;
    await _session?.setMic(on);
  }

  /// Our camera on/off — in a voice call this publishes it: a video call now.
  @override
  Future<void> setCameraOn(bool on) async {
    _cameraOn = on;
    if (on) _isVideo = true;
    await _session?.setCamera(on);
  }

  @override
  Future<void> setSpeakerOn(bool on) async {
    _speakerOn = on;
    await _session?.setSpeaker(on);
  }

  @override
  Future<void> switchCamera() async => _session?.switchCamera();

  @override
  void dispose() => _teardown(keepPending: false);

  // ---------------------------------------------------------------------------

  void _reset(
      {required String targetId,
      required String conversationId,
      required bool isVideo}) {
    _teardown(keepPending: false, notify: false);
    _targetId = targetId;
    _conversationId = conversationId;
    _isVideo = isVideo;
    _micOn = true;
    _cameraOn = isVideo;
    reconnecting.value = false;
    poorConnection.value = false;
    network.reset(peerCamera: isVideo);
  }

  void _hold(String conversationId) {
    _release();
    _heldConversation = conversationId;
    _port.holdConversation(conversationId);
    _eventsSub = _port.callEvents.listen(_onCallEvent);
  }

  void _release() {
    _eventsSub?.cancel();
    _eventsSub = null;
    final held = _heldConversation;
    _heldConversation = null;
    if (held != null) _port.releaseConversation(held);
  }

  void _onCallEvent(Map<String, dynamic> e) {
    if (e['conversationId'] != null && e['conversationId'] != _conversationId) {
      return;
    }
    switch (e['event']) {
      case 'call.started':
        // Their call (both tapped Call) is not our start: call-merged follows.
        if (e['startedBy'] != null && e['startedBy'] == _targetId) return;
        _onStarted(e['callId'] as String?, e['transport'] as String?);
      case 'call.ended':
        if (e['callId'] != null && e['callId'] == _callId) {
          _remoteEnded(CallEndReason.fromWire(e['reason'] as String?));
        }
    }
  }

  void _onStarted(String? callId, String? transport) {
    if (!_pendingStart || callId == null) return;
    _pendingStart = false;
    _pendingTimer?.cancel();
    _pendingTimer = null;
    final cancelled = _cancelledBeforeStart;
    if (cancelled != null) {
      _cancelledBeforeStart = null;
      _port.send('/app/call.cancel', {
        'callId': callId,
        'reason': cancelled == CallEndReason.noAnswer ? 'no_answer' : 'hangup'
      });
      _port.send('/app/call.leave', {'callId': callId});
      _release();
      return;
    }
    if (CallTransport.fromWire(transport) != CallTransport.sfu) {
      // The server moved back to mesh after we read the config: end that
      // session, re-read the transport and let the user retry.
      _port.send('/app/call.leave', {'callId': callId});
      unawaited(_transport.refresh(_api));
      failLocally(CallEndReason.failed);
      return;
    }
    _callId = callId;
    unawaited(_join());
  }

  void _remoteEnded(CallEndReason reason) {
    final unanswered = _incoming && !_accepting;
    if (!unanswered) onEndNotice?.call(reason, true);
    dispose();
  }

  /// Join (or, [rejoin], re-join after losing) the call's room. A failed
  /// rejoin is retried by the reconnect window.
  Future<void> _join({bool rejoin = false}) async {
    final callId = _callId;
    if (callId == null) return;
    CallToken token;
    try {
      token = await _api.getToken(callId);
    } catch (_) {
      if (!rejoin && _callId == callId) {
        await endCall(reason: CallEndReason.failed);
      }
      return;
    }
    if (_callId != callId) return;
    // Never two room sessions per identity; detach so its onDisconnected is moot.
    final previous = _session;
    _session = null;
    if (previous != null) unawaited(previous.disconnect());
    final session = _sessionFactory();
    _session = session;
    session
      ..onLocalStream = ((s) => onLocalStream?.call(s))
      ..onPeersChanged = ((_) => _onPeers())
      ..onReconnecting = (on) {
        reconnecting.value = on;
        if (on) {
          _watch.begin(ReconnectWho.self, _giveUp);
        } else if (_peerInRoom()) {
          _watch.end();
        }
      }
      ..onLocalPoorConnection = (poor) {
        poorConnection.value = poor;
        network.selfPoor = poor;
      }
      ..onDisconnected = (reason) {
        if (_session != session) return;
        if (reason == RtcEnd.ended) {
          // The server closed the room: the other side hung up.
          _remoteEnded(CallEndReason.hangup);
        } else {
          // LiveKit could not resume: keep the screen, re-join for a minute.
          _watch.begin(ReconnectWho.self, _giveUp,
              tick: () => unawaited(_rejoin(callId)));
        }
      };
    try {
      // A rejoin keeps the camera as the user left it.
      await session.connect(token.url, token.token,
          video: rejoin ? _cameraOn : _isVideo);
    } catch (e) {
      if (rejoin || _session != session) return;
      await endCall(
          reason: e is MediaAccessException
              ? CallEndReason.mediaError
              : CallEndReason.failed);
      return;
    }
    if (_session != session) return;
    if (!rejoin) return setSpeakerOn(_isVideo);
    // Back in the room: restore what connect() reset, see whether they are here.
    if (!_micOn) await session.setMic(false); // connect() always opens the mic
    await setSpeakerOn(_speakerOn);
    reconnecting.value = false;
    _onPeers();
  }

  void _giveUp() => unawaited(endCall(reason: CallEndReason.failed));

  Future<void> _rejoin(String callId) async {
    if (_rejoining || _callId != callId) return;
    _rejoining = true;
    try {
      await _join(rejoin: true);
    } finally {
      _rejoining = false;
    }
  }

  bool _peerInRoom() {
    final target = _targetId;
    return target != null && _session?.peer(target) != null;
  }

  void _onPeers() {
    final target = _targetId;
    final peer = target == null ? null : _session?.peer(target);
    if (peer == null) {
      // Gone without the call ending (crash, lost network): wait a minute,
      // as the server does.
      if (_connected) _watch.begin(ReconnectWho.peer, _giveUp);
      return;
    }
    if (!reconnecting.value) _watch.end();
    network.peerPoor = peer.poorConnection;
    // Their camera: known once they publish video; until then the call kind stands.
    if ((peer.stream?.getVideoTracks() ?? const []).isNotEmpty) {
      network.peerCamera = !peer.camMuted;
      if (!peer.camMuted) _isVideo = true;
    }
    final stream = peer.stream;
    if (stream == null || identical(stream, _lastRemote)) return;
    _lastRemote = stream;
    _connected = true;
    _mediaSince ??= DateTime.now();
    onRemoteStream?.call(stream);
  }

  void _teardown({required bool keepPending, bool notify = true}) {
    _watch.end();
    _rejoining = false;
    final session = _session;
    _session = null;
    if (session != null) unawaited(session.disconnect());
    _callId = null;
    _accepting = false;
    _probing = false;
    _connected = false;
    _lastRemote = null;
    _mediaSince = null;
    reconnecting.value = false;
    poorConnection.value = false;
    if (!keepPending) {
      _pendingTimer?.cancel();
      _pendingTimer = null;
      _pendingStart = false;
      _cancelledBeforeStart = null;
      _release();
    }
    if (notify) onCallEnded?.call();
  }
}

/// Call-log contents shared with [WebRTCService] (same wire format as web).
abstract final class WebRTCServiceLogs {
  static String missed(bool isVideo) =>
      'system.call.missed:${isVideo ? 'video' : 'voice'}';
}

Future<bool> _probeDeviceMedia(bool video) async {
  try {
    final stream = await navigator.mediaDevices
        .getUserMedia({'audio': true, 'video': video});
    for (final t in stream.getTracks()) {
      await t.stop();
    }
    await stream.dispose();
    return true;
  } catch (_) {
    return false;
  }
}

final sfuCallServiceProvider = Provider<SfuCallService>((ref) {
  return SfuCallService(
    port: StompCallSignalPort(ref.watch(stompServiceProvider.notifier)),
    api: ref.watch(callsRepositoryProvider),
    transport: ref.watch(callTransportProvider),
    sessionFactory: LiveKitSession.new,
    probeMedia: _probeDeviceMedia,
  );
});
