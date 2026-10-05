import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import '../../../core/rtc/livekit_session.dart';
import '../../../core/rtc/rtc_session.dart';
import '../data/calls_repository.dart';
import '../data/stomp_service.dart';
import 'call_rules.dart';
import 'call_transport.dart';
import 'direct_call_engine.dart';

/// The STOMP side a LiveKit call needs, so the engine runs without a socket
/// in tests. [holdConversation] keeps the conversation topic subscribed for
/// the call's lifetime (ref-counted with the chat screen).
abstract class CallSignalPort {
  void send(String destination, Map<String, dynamic> body);
  void holdConversation(String conversationId);
  void releaseConversation(String conversationId);
  Stream<Map<String, dynamic>> get callEvents;
}

class StompCallSignalPort implements CallSignalPort {
  final StompService _stomp;
  StompCallSignalPort(this._stomp);

  @override
  void send(String destination, Map<String, dynamic> body) =>
      _stomp.sendRawMessage(destination: destination, body: jsonEncode(body));
  @override
  void holdConversation(String conversationId) => _stomp.subscribeConversation(conversationId);
  @override
  void releaseConversation(String conversationId) => _stomp.unsubscribeConversation(conversationId);
  @override
  Stream<Map<String, dynamic>> get callEvents => _stomp.callEvents;
}

const _declineReasons = {CallEndReason.declined, CallEndReason.busy, CallEndReason.mediaError};

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

  SfuCallService({
    required CallSignalPort port,
    required CallsApi api,
    required CallTransportCache transport,
    required RtcSessionFactory sessionFactory,
    required Future<bool> Function(bool video) probeMedia,
    Duration peerGrace = const Duration(seconds: 8),
  })  : _port = port,
        _api = api,
        _transport = transport,
        _sessionFactory = sessionFactory,
        _probeMedia = probeMedia,
        _peerGrace = peerGrace;

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
  Timer? _peerGoneTimer;
  DateTime? _mediaSince;
  bool _micOn = true;
  bool _cameraOn = true;
  bool _speakerOn = false;

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
    _reset(targetId: targetId, conversationId: conversationId, isVideo: isVideo);
    _incoming = false;
    _pendingStart = true;
    _hold(conversationId);
    _port.send('/app/call.start', {'conversationId': conversationId, 'media': isVideo ? 'video' : 'audio'});
  }

  /// Callee: the call screen opened for a ring the user tapped Answer on.
  void prepareIncoming({
    required String targetId,
    required String conversationId,
    required String callId,
    required bool isVideo,
  }) {
    _reset(targetId: targetId, conversationId: conversationId, isVideo: isVideo);
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

  /// `/user/queue/webrtc` signals for this call.
  void handleSignal(Map<String, dynamic> signal) {
    switch (signal['type']) {
      case 'call-declined':
        if (_incoming || _connected) return;
        final sameCall = signal['callId'] != null
            ? signal['callId'] == _callId
            : _pendingStart && signal['conversationId'] == _conversationId;
        if (!sameCall) return;
        final reason = CallEndReason.fromWire(signal['reason'] as String?);
        if (reason == CallEndReason.busy) onSendCallLog?.call(WebRTCServiceLogs.missed(_isVideo));
        onEndNotice?.call(reason, true);
        dispose();
      case 'call-ring-cancel':
        // Our own answer echoes back as answered_elsewhere: ignore it then.
        if (!_incoming || _accepting || signal['callId'] != _callId) return;
        dispose();
    }
  }

  @override
  Future<void> endCall({int? duration, CallEndReason reason = CallEndReason.hangup}) async {
    final callId = _callId;
    final secs = duration ?? (_mediaSince == null ? 0 : DateTime.now().difference(_mediaSince!).inSeconds);
    var keepPending = false;
    if (_incoming && !_accepting) {
      if (callId != null) {
        final why = _declineReasons.contains(reason) ? reason : CallEndReason.declined;
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

  @override
  Future<void> setCameraOn(bool on) async {
    _cameraOn = on;
    await _session?.setCamera(on);
  }

  @override
  Future<void> setSpeakerOn(bool on) async {
    _speakerOn = on;
    try {
      await Helper.setSpeakerphoneOn(on);
    } catch (_) {
      // no audio route to change (tests, desktop)
    }
  }

  @override
  Future<void> switchCamera() async => _session?.switchCamera();

  @override
  void dispose() => _teardown(keepPending: false);

  // ---------------------------------------------------------------------------

  void _reset({required String targetId, required String conversationId, required bool isVideo}) {
    _teardown(keepPending: false, notify: false);
    _targetId = targetId;
    _conversationId = conversationId;
    _isVideo = isVideo;
    _micOn = true;
    _cameraOn = isVideo;
    reconnecting.value = false;
    poorConnection.value = false;
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
    if (e['conversationId'] != null && e['conversationId'] != _conversationId) return;
    switch (e['event']) {
      case 'call.started':
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
    final cancelled = _cancelledBeforeStart;
    if (cancelled != null) {
      _cancelledBeforeStart = null;
      _port.send('/app/call.cancel',
          {'callId': callId, 'reason': cancelled == CallEndReason.noAnswer ? 'no_answer' : 'hangup'});
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

  Future<void> _join() async {
    final callId = _callId;
    if (callId == null) return;
    CallToken token;
    try {
      token = await _api.getToken(callId);
    } catch (_) {
      if (_callId == callId) await endCall(reason: CallEndReason.failed);
      return;
    }
    if (_callId != callId) return;
    final session = _sessionFactory();
    _session = session;
    session
      ..onLocalStream = ((s) => onLocalStream?.call(s))
      ..onPeersChanged = ((_) => _onPeers())
      ..onReconnecting = ((on) => reconnecting.value = on)
      ..onLocalPoorConnection = ((poor) => poorConnection.value = poor)
      ..onDisconnected = (reason) {
        if (_session != session) return;
        if (reason == RtcEnd.ended) {
          // The server closed the room: the other side hung up.
          _remoteEnded(CallEndReason.hangup);
        } else {
          unawaited(endCall(reason: CallEndReason.failed));
        }
      };
    try {
      await session.connect(token.url, token.token, video: _isVideo);
    } catch (e) {
      if (_session != session) return;
      await endCall(reason: e is MediaAccessException ? CallEndReason.mediaError : CallEndReason.failed);
    }
  }

  void _onPeers() {
    final target = _targetId;
    final peer = target == null ? null : _session?.peer(target);
    if (peer == null) {
      if (_connected && _peerGoneTimer == null) {
        _peerGoneTimer = Timer(_peerGrace, () {
          _peerGoneTimer = null;
          if (_connected) unawaited(endCall(reason: CallEndReason.failed));
        });
      }
      return;
    }
    _peerGoneTimer?.cancel();
    _peerGoneTimer = null;
    final stream = peer.stream;
    if (stream == null || identical(stream, _lastRemote)) return;
    _lastRemote = stream;
    _connected = true;
    _mediaSince ??= DateTime.now();
    onRemoteStream?.call(stream);
  }

  void _teardown({required bool keepPending, bool notify = true}) {
    _peerGoneTimer?.cancel();
    _peerGoneTimer = null;
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
      _pendingStart = false;
      _cancelledBeforeStart = null;
      _release();
    }
    if (notify) onCallEnded?.call();
  }
}

/// Call-log contents shared with [WebRTCService] (same wire format as web).
abstract final class WebRTCServiceLogs {
  static String missed(bool isVideo) => 'system.call.missed:${isVideo ? 'video' : 'voice'}';
}

Future<bool> _probeDeviceMedia(bool video) async {
  try {
    final stream = await navigator.mediaDevices.getUserMedia({'audio': true, 'video': video});
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
