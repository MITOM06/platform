import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/chat/domain/group_call_controller.dart';
import '../../features/chat/domain/sfu_call_service.dart';
import '../../features/chat/domain/webrtc_service.dart';
import '../../features/meetings/state/active_room.dart';

/// Reads a provider — `ref.read` of a widget, a provider or a container.
typedef ProviderRead = T Function<T>(ProviderListenable<T> provider);

/// Whether the realtime (STOMP) socket stays up while the app is in the
/// background. Normally it closes, so Redis marks the user offline and
/// messages arrive as FCM pushes. A meeting or a call keeps running in the
/// background and lives on its signals: a peer-to-peer call's end, ICE
/// restarts and state, a LiveKit call's declines and answers — and a
/// `call.leave` sent right after resuming would be dropped on a closed socket.
bool keepRealtimeInBackground({
  required bool meeting,
  required bool directCall,
  required bool groupCall,
}) =>
    meeting || directCall || groupCall;

/// A 1-on-1 (peer-to-peer or LiveKit) is starting, ringing out or running.
bool directCallInProgress(ProviderRead read) =>
    read(webRtcServiceProvider).isActive ||
    read(sfuCallServiceProvider).isActive;

/// This device is in a group call.
bool groupCallInProgress(ProviderRead read) =>
    read(groupCallControllerProvider).isActive;

/// Any call — 1-on-1 or group — is in progress on this device.
bool callInProgress(ProviderRead read) =>
    directCallInProgress(read) || groupCallInProgress(read);

/// [keepRealtimeInBackground] for the live state of this device.
bool keepRealtimeOnPause(ProviderRead read) => keepRealtimeInBackground(
      meeting: meetingInProgress(),
      directCall: directCallInProgress(read),
      groupCall: groupCallInProgress(read),
    );
