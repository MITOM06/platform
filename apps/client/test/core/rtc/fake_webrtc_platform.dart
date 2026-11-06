import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// The native side of flutter_webrtc, faked at its method channel
/// (`FlutterWebRTC.Method`) so the call engines' own logic runs in tests:
/// peer connections, getUserMedia, tracks and video renderers answer with
/// plausible maps, every call is recorded, and peer-connection events
/// (`connectionState`, `onTrack`, `signalingState`…) can be pushed back.
///
/// This fakes the PLUGIN's platform half; the plugin's Dart half runs for real.
class FakeWebRtcPlatform {
  static const method = MethodChannel('FlutterWebRTC.Method');

  final calls = <MethodCall>[];
  final _sinks = <String, MockStreamHandlerEventSink>{};
  final _eventChannels = <EventChannel>[];
  int _pc = 0;
  int _stream = 0;
  int _track = 0;
  int _texture = 0;

  /// getUserMedia: return a response map, or throw (e.g. PlatformException)
  /// to simulate a refused permission / missing device. Null = default.
  Future<Map<String, Object?>> Function(Map<Object?, Object?> constraints)?
      onGetUserMedia;

  /// createPeerConnection waits on this when set (a slow native side).
  Completer<void>? peerGate;

  String offerSdp = 'v=0\r\nm=audio 9 offer';
  String answerSdp = 'v=0\r\nm=audio 9 answer';

  /// Methods that throw a PlatformException instead of answering.
  final failing = <String>{};

  TestDefaultBinaryMessenger get _messenger =>
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  void install() {
    _messenger.setMockMethodCallHandler(method, _handle);
  }

  void uninstall() {
    _messenger.setMockMethodCallHandler(method, null);
    for (final c in _eventChannels) {
      _messenger.setMockStreamHandler(c, null);
    }
  }

  List<MethodCall> named(String name) =>
      calls.where((c) => c.method == name).toList();

  List<Object?> argsOf(String name, String key) =>
      named(name).map((c) => (c.arguments as Map)[key]).toList();

  /// Ids of every peer connection created so far.
  List<String> get peerIds => [for (var i = 1; i <= _pc; i++) 'pc$i'];

  /// Push an event the native peer connection [pcId] would emit.
  Future<void> emit(String pcId, Map<String, Object?> event) async {
    final sink = _sinks[pcId];
    if (sink == null) throw StateError('no listener on $pcId');
    sink.success(event);
    await pumpEventQueue();
  }

  Future<void> connectionState(String pcId, String state) =>
      emit(pcId, {'event': 'peerConnectionState', 'state': state});

  Future<void> signalingState(String pcId, String state) =>
      emit(pcId, {'event': 'signalingState', 'state': state});

  Future<void> iceCandidate(String pcId, String candidate) => emit(pcId, {
        'event': 'onCandidate',
        'candidate': {
          'candidate': candidate,
          'sdpMid': '0',
          'sdpMLineIndex': 0
        },
      });

  /// Remote media arriving on [pcId] (Unified Plan `onTrack`).
  Future<void> remoteTrack(String pcId,
          {String? streamId = 'remote1', String kind = 'video'}) =>
      emit(pcId, {
        'event': 'onTrack',
        'streams': [
          if (streamId != null)
            {
              'streamId': streamId,
              'ownerTag': pcId,
              'audioTracks': <Object?>[],
              'videoTracks': [
                if (kind == 'video') _trackMap('rv$streamId', 'video'),
              ],
            },
        ],
        'receiver': {
          'receiverId': 'r1',
          'track': _trackMap('rt', kind),
          'rtpParameters': _rtpParameters,
        },
        'track': _trackMap('rt', kind),
      });

  static const _rtpParameters = <String, Object?>{
    'encodings': <Object?>[],
    'headerExtensions': <Object?>[],
    'codecs': <Object?>[],
    'rtcp': {'cname': 'c', 'reducedSize': false},
  };

  Map<String, Object?> _trackMap(String id, String kind) =>
      {'id': id, 'label': id, 'kind': kind, 'enabled': true};

  Map<String, Object?> userMedia({bool audio = true, bool video = true}) {
    final s = ++_stream;
    return {
      'streamId': 'local$s',
      'audioTracks': [if (audio) _trackMap('a${++_track}', 'audio')],
      'videoTracks': [if (video) _trackMap('v${++_track}', 'video')],
    };
  }

  void _listen(String channel, String key) {
    final c = EventChannel(channel);
    _eventChannels.add(c);
    _messenger.setMockStreamHandler(
      c,
      MockStreamHandler.inline(onListen: (_, sink) {
        _sinks[key] = sink;
      }),
    );
  }

  Future<Object?> _handle(MethodCall call) async {
    calls.add(call);
    if (failing.contains(call.method)) {
      throw PlatformException(code: 'error', message: '${call.method} failed');
    }
    final args = (call.arguments as Map?) ?? const {};
    switch (call.method) {
      case 'createPeerConnection':
        final gate = peerGate;
        if (gate != null) await gate.future;
        final id = 'pc${++_pc}';
        _listen('FlutterWebRTC/peerConnectionEvent$id', id);
        return {'peerConnectionId': id};
      case 'getUserMedia':
        final constraints = (args['constraints'] as Map?) ?? const {};
        final custom = onGetUserMedia;
        if (custom != null) return custom(constraints);
        final video = constraints['video'];
        return userMedia(
          audio: constraints['audio'] != false,
          video: video != null && video != false,
        );
      case 'createOffer':
        return {'sdp': offerSdp, 'type': 'offer'};
      case 'createAnswer':
        return {'sdp': answerSdp, 'type': 'answer'};
      case 'addTrack':
        return {
          'senderId': 'sender${calls.length}',
          'ownsTrack': true,
          'track': _trackMap(args['trackId'] as String? ?? 't', 'audio'),
          'rtpParameters': _rtpParameters,
        };
      case 'createVideoRenderer':
        final id = ++_texture;
        _listen('FlutterWebRTC/Texture$id', 'texture$id');
        return {'textureId': id};
      case 'getTransceivers':
        return {'transceivers': <Object?>[]};
      case 'getStats':
        return {'stats': <Object?>[]};
      case 'requestCapturePermission':
        return true;
    }
    return null;
  }
}
