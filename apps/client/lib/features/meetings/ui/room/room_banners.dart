import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../state/meeting_room_providers.dart';
import 'room_controls.dart';

/// Connection notices over the stage: LiveKit reconnecting, STOMP offline,
/// unstable connection — mirror of web `RoomBanners`.
class RoomBanners extends ConsumerWidget {
  const RoomBanners({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final reconnecting =
        ref.watch(meetingRoomStoreProvider.select((s) => s.reconnecting));
    final poor =
        ref.watch(meetingRoomStoreProvider.select((s) => s.poorConnection));
    final online = ref.watch(stompConnectedProvider).valueOrNull ?? true;
    final (Widget? icon, String? text) = reconnecting
        ? (
            const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white)),
            l.meetingReconnecting
          )
        : !online
            ? (
                const Icon(Icons.wifi_off_rounded,
                    size: 16, color: Colors.white),
                l.meetingRealtimeOffline
              )
            : poor
                ? (
                    const Icon(Icons.signal_cellular_alt_1_bar_rounded,
                        size: 16, color: Colors.white),
                    l.meetingPoorConnection
                  )
                : (null, null);
    return Semantics(
      liveRegion: true,
      child: Center(
        child: text == null || icon == null
            ? const SizedBox.shrink()
            : Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                    color: kStagePill,
                    borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  icon,
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(text,
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w500)),
                  ),
                ]),
              ),
      ),
    );
  }
}
