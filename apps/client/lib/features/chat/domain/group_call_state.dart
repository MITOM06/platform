import 'package:flutter_webrtc/flutter_webrtc.dart';

/// A participant currently in (or invited to) a group call. Mirrors the
/// `call.roster` participant shape from the cross-platform contract (§3).
class CallParticipant {
  final String userId;
  final String displayName;
  final DateTime? joinedAt;
  final DateTime? leftAt;

  const CallParticipant({
    required this.userId,
    required this.displayName,
    this.joinedAt,
    this.leftAt,
  });

  /// A roster entry counts as "present" while it has no leftAt.
  bool get isPresent => leftAt == null;

  factory CallParticipant.fromJson(Map<String, dynamic> json) {
    DateTime? parse(dynamic v) =>
        v == null ? null : DateTime.tryParse(v.toString());
    return CallParticipant(
      userId: (json['userId'] ?? '').toString(),
      displayName: (json['displayName'] ?? '').toString(),
      joinedAt: parse(json['joinedAt']),
      leftAt: parse(json['leftAt']),
    );
  }
}

/// Holds the renderer + metadata for one remote peer in the mesh.
class RemotePeer {
  final String peerId;
  final RTCVideoRenderer renderer;
  bool hasVideo;

  RemotePeer({
    required this.peerId,
    required this.renderer,
    this.hasVideo = false,
  });
}

/// Riverpod state for the active group call. Immutable; the controller
/// replaces it on every change so `ref.watch` rebuilds the UI.
class GroupCallState {
  /// Null when no group call is active for this client.
  final String? callId;
  final String conversationId;
  final bool isVideo;
  final bool aiNotetaker;

  /// Whether THIS client started the call (only the starter toggles STT/AI).
  final bool isStarter;

  final bool micEnabled;
  final bool camEnabled;

  /// True once the local media stream is acquired and we have joined.
  final bool joined;

  /// Live roster from `call.roster` (includes self).
  final List<CallParticipant> roster;

  /// Whether client-side speech-to-text is actively transcribing.
  final bool sttActive;

  const GroupCallState({
    this.callId,
    this.conversationId = '',
    this.isVideo = false,
    this.aiNotetaker = false,
    this.isStarter = false,
    this.micEnabled = true,
    this.camEnabled = true,
    this.joined = false,
    this.roster = const [],
    this.sttActive = false,
  });

  bool get isActive => callId != null;

  /// Present participants other than self count for the "N joined" label.
  int get presentCount => roster.where((p) => p.isPresent).length;

  GroupCallState copyWith({
    String? callId,
    bool clearCallId = false,
    String? conversationId,
    bool? isVideo,
    bool? aiNotetaker,
    bool? isStarter,
    bool? micEnabled,
    bool? camEnabled,
    bool? joined,
    List<CallParticipant>? roster,
    bool? sttActive,
  }) {
    return GroupCallState(
      callId: clearCallId ? null : (callId ?? this.callId),
      conversationId: conversationId ?? this.conversationId,
      isVideo: isVideo ?? this.isVideo,
      aiNotetaker: aiNotetaker ?? this.aiNotetaker,
      isStarter: isStarter ?? this.isStarter,
      micEnabled: micEnabled ?? this.micEnabled,
      camEnabled: camEnabled ?? this.camEnabled,
      joined: joined ?? this.joined,
      roster: roster ?? this.roster,
      sttActive: sttActive ?? this.sttActive,
    );
  }
}

/// An incoming `call-ring` signal (§3) — shown as an incoming-call prompt.
class IncomingGroupCall {
  final String callId;
  final String conversationId;
  final String startedById;
  final String startedByName;
  final bool isVideo;
  final bool aiNotetaker;

  const IncomingGroupCall({
    required this.callId,
    required this.conversationId,
    required this.startedById,
    required this.startedByName,
    required this.isVideo,
    required this.aiNotetaker,
  });
}
