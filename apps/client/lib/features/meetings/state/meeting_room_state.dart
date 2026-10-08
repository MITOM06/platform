// UI + room data of the open meeting room — mirror of web
// `lib/store/meeting.store.ts`, plus the room-only server data the web keeps
// in TanStack (roster, hands, lobby, chat history). One immutable snapshot,
// written by MeetingRoomController through a [RoomStore].

import 'package:flutter_webrtc/flutter_webrtc.dart';

import '../../../core/rtc/rtc_session.dart';
import '../domain/cache_updates.dart';
import '../domain/meeting_models.dart';
import '../domain/meeting_room_models.dart';
import '../domain/meeting_text.dart';
import '../domain/note_sync.dart';
import '../domain/room_phase.dart';
import '../domain/stage_layout.dart';

enum RoomPanel { people, chat, notes }

/// A chat line sent but not yet echoed back by the server.
class PendingChat {
  const PendingChat({
    required this.clientId,
    required this.content,
    required this.sentAt,
    this.error,
  });

  final String clientId;
  final String content;
  final DateTime sentAt;
  final MeetingNotice? error;

  /// [error] is always replaced (null clears it).
  PendingChat copyWith({DateTime? sentAt, MeetingNotice? error}) => PendingChat(
      clientId: clientId,
      content: content,
      sentAt: sentAt ?? this.sentAt,
      error: error);

  @override
  bool operator ==(Object other) =>
      other is PendingChat &&
      other.clientId == clientId &&
      other.content == content &&
      other.sentAt == sentAt &&
      other.error == error;

  @override
  int get hashCode => Object.hash(clientId, content, sentAt, error);

  @override
  String toString() => 'PendingChat($clientId, $content, $sentAt, $error)';
}

class FloatingReaction {
  const FloatingReaction({
    required this.id,
    required this.emoji,
    this.name,
    required this.mine,
  });

  final int id;
  final String emoji;

  /// Already safe for display (never an id); null ⇒ generic label.
  final String? name;
  final bool mine;
}

/// Immutable snapshot of an [RtcPeer] (the session mutates its peers in
/// place).
class MeetingPeer {
  const MeetingPeer({
    required this.identity,
    required this.name,
    this.stream,
    this.screen,
    this.speaking = false,
    this.micMuted = true,
    this.camMuted = true,
    this.poorConnection = false,
    this.avatarUrl,
  });

  factory MeetingPeer.of(RtcPeer p) => MeetingPeer(
        identity: p.identity,
        name: p.name,
        stream: p.stream,
        screen: p.screen,
        speaking: p.speaking,
        micMuted: p.micMuted,
        camMuted: p.camMuted,
        poorConnection: p.poorConnection,
        avatarUrl: p.avatarUrl,
      );

  final String identity;

  /// '' when unknown — never the raw identity.
  final String name;
  final MediaStream? stream;
  final MediaStream? screen;
  final bool speaking;
  final bool micMuted;
  final bool camMuted;
  final bool poorConnection;
  final String? avatarUrl;
}

const _keep = Object();

class MeetingRoomState {
  const MeetingRoomState({
    this.phase = RoomPhase.loading,
    this.myRole = MeetingRoomRole.attendee,
    this.settings = MeetingSettings.defaults,
    this.mic = false,
    this.camera = false,
    this.screen = false,
    this.frontCamera = true,
    this.speakerOn = true,
    this.reconnecting = false,
    this.poorConnection = false,
    this.peers = const [],
    this.localStream,
    this.localScreen,
    this.activeSpeakerId,
    this.layout = LayoutMode.grid,
    this.pinnedKey,
    this.panel,
    this.unreadChat = 0,
    this.pendingChat = const [],
    this.pendingHost = const {},
    this.reactions = const [],
    this.roster = const [],
    this.hands = const [],
    this.lobby = const [],
    this.chat = const ChatHistory(),
    this.chatSeeded = false,
    this.sharedNoteRemote,
    this.sharedNoteResync = 0,
  });

  static const initial = MeetingRoomState();

  final RoomPhase phase;
  final MeetingRoomRole myRole;
  final MeetingSettings settings;
  final bool mic;
  final bool camera;
  final bool screen;
  final bool frontCamera;
  final bool speakerOn;
  final bool reconnecting;
  final bool poorConnection;
  final List<MeetingPeer> peers;
  final MediaStream? localStream;
  final MediaStream? localScreen;

  /// Sticky: the last remote person who spoke.
  final String? activeSpeakerId;
  final LayoutMode layout;
  final String? pinnedKey;
  final RoomPanel? panel;
  final int unreadChat;
  final List<PendingChat> pendingChat;

  /// Switch commands sent and not yet confirmed by `meet.settings`.
  final Map<HostAction, DateTime> pendingHost;
  final List<FloatingReaction> reactions;
  final List<RosterEntry> roster;

  /// Raised hands, earliest first.
  final List<MeetingHand> hands;
  final List<LobbyEntry> lobby;
  final ChatHistory chat;

  /// The first chat page read has answered (until then: a spinner, not
  /// "no messages").
  final bool chatSeeded;
  final RemoteNewer? sharedNoteRemote;

  /// Bumped after a reconnect: the shared note re-reads itself when clean.
  final int sharedNoteResync;

  bool get isLive => phase == RoomPhase.connecting || phase == RoomPhase.inRoom;

  /// The nullable fields ([localStream], [localScreen], [activeSpeakerId],
  /// [pinnedKey], [panel], [sharedNoteRemote]) accept null to clear them.
  MeetingRoomState copyWith({
    RoomPhase? phase,
    MeetingRoomRole? myRole,
    MeetingSettings? settings,
    bool? mic,
    bool? camera,
    bool? screen,
    bool? frontCamera,
    bool? speakerOn,
    bool? reconnecting,
    bool? poorConnection,
    List<MeetingPeer>? peers,
    Object? localStream = _keep,
    Object? localScreen = _keep,
    Object? activeSpeakerId = _keep,
    LayoutMode? layout,
    Object? pinnedKey = _keep,
    Object? panel = _keep,
    int? unreadChat,
    List<PendingChat>? pendingChat,
    Map<HostAction, DateTime>? pendingHost,
    List<FloatingReaction>? reactions,
    List<RosterEntry>? roster,
    List<MeetingHand>? hands,
    List<LobbyEntry>? lobby,
    ChatHistory? chat,
    bool? chatSeeded,
    Object? sharedNoteRemote = _keep,
    int? sharedNoteResync,
  }) {
    T pick<T>(Object? v, T current) => identical(v, _keep) ? current : v as T;
    return MeetingRoomState(
      phase: phase ?? this.phase,
      myRole: myRole ?? this.myRole,
      settings: settings ?? this.settings,
      mic: mic ?? this.mic,
      camera: camera ?? this.camera,
      screen: screen ?? this.screen,
      frontCamera: frontCamera ?? this.frontCamera,
      speakerOn: speakerOn ?? this.speakerOn,
      reconnecting: reconnecting ?? this.reconnecting,
      poorConnection: poorConnection ?? this.poorConnection,
      peers: peers ?? this.peers,
      localStream: pick<MediaStream?>(localStream, this.localStream),
      localScreen: pick<MediaStream?>(localScreen, this.localScreen),
      activeSpeakerId: pick<String?>(activeSpeakerId, this.activeSpeakerId),
      layout: layout ?? this.layout,
      pinnedKey: pick<String?>(pinnedKey, this.pinnedKey),
      panel: pick<RoomPanel?>(panel, this.panel),
      unreadChat: unreadChat ?? this.unreadChat,
      pendingChat: pendingChat ?? this.pendingChat,
      pendingHost: pendingHost ?? this.pendingHost,
      reactions: reactions ?? this.reactions,
      roster: roster ?? this.roster,
      hands: hands ?? this.hands,
      lobby: lobby ?? this.lobby,
      chat: chat ?? this.chat,
      chatSeeded: chatSeeded ?? this.chatSeeded,
      sharedNoteRemote:
          pick<RemoteNewer?>(sharedNoteRemote, this.sharedNoteRemote),
      sharedNoteResync: sharedNoteResync ?? this.sharedNoteResync,
    );
  }
}

/// Where the controller writes the room state — a Riverpod notifier in the
/// app, [MemoryRoomStore] in unit tests.
abstract interface class RoomStore {
  MeetingRoomState get value;
  void update(MeetingRoomState Function(MeetingRoomState s) fn);
  void reset();
}

class MemoryRoomStore implements RoomStore {
  @override
  MeetingRoomState value = MeetingRoomState.initial;

  @override
  void update(MeetingRoomState Function(MeetingRoomState s) fn) =>
      value = fn(value);

  @override
  void reset() => value = MeetingRoomState.initial;
}
