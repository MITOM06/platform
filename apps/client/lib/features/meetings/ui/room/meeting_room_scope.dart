import 'package:flutter/widgets.dart';

import '../../domain/meeting_models.dart';
import '../../state/meeting_room_controller.dart';

/// The open room for every widget of `/meet/:code` — web `RoomContext`.
/// Room state itself is read from `meetingRoomStoreProvider` with narrow
/// `select`s; this only carries what never changes while the room is open.
class MeetingRoomScope extends InheritedWidget {
  const MeetingRoomScope({
    super.key,
    required this.controller,
    required this.meeting,
    required this.myId,
    this.myName = '',
    this.myAvatarUrl,
    required super.child,
  });

  final MeetingRoomController controller;

  /// As loaded by code (live settings / role are in the room store).
  final Meeting meeting;
  final String myId;

  /// Already humanized; '' when unknown (callers fall back to "You").
  final String myName;
  final String? myAvatarUrl;

  static MeetingRoomScope of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<MeetingRoomScope>();
    if (scope == null) {
      throw StateError('MeetingRoomScope is missing above this widget');
    }
    return scope;
  }

  /// Without a dependency — for `initState` and callbacks.
  static MeetingRoomScope read(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<MeetingRoomScope>();
    if (scope == null) {
      throw StateError('MeetingRoomScope is missing above this widget');
    }
    return scope;
  }

  /// Bottom sheets live on the navigator, above the scope: they re-provide it.
  Widget wrap(Widget child) => MeetingRoomScope(
        controller: controller,
        meeting: meeting,
        myId: myId,
        myName: myName,
        myAvatarUrl: myAvatarUrl,
        child: child,
      );

  @override
  bool updateShouldNotify(MeetingRoomScope old) =>
      old.controller != controller ||
      old.meeting != meeting ||
      old.myId != myId ||
      old.myName != myName ||
      old.myAvatarUrl != myAvatarUrl;
}
