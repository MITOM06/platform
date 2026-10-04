import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/chat_repository.dart';
import '../../domain/call_name_resolver.dart';
import '../../domain/incoming_call.dart';
import '../../domain/webrtc_service.dart';

/// Global overlay for an incoming 1-on-1 call (mirror of web `CallOverlay`'s
/// `status === 'incoming'` prompt). Accept → open the call screen, which
/// answers the stored offer. Decline → tell the caller (`/app/call.end`) and
/// log a missed call, exactly like web `callManager.endCall()` on decline.
///
/// Mounted once via MaterialApp.router's `builder` so it floats above any
/// route.
class IncomingCallPrompt extends ConsumerWidget {
  final Widget child;
  const IncomingCallPrompt({super.key, required this.child});

  void _accept(WidgetRef ref, IncomingCall call, String callerName) {
    ref.read(incomingCallProvider.notifier).clear();
    ref.read(appRouterProvider).push('/call', extra: {
      'targetId': call.senderId, // we reply back to the caller
      'targetName': callerName,
      'conversationId': call.conversationId,
      'isCaller': false,
      'initialOfferSdp': call.sdp,
    });
  }

  void _decline(WidgetRef ref, IncomingCall call) {
    ref.read(incomingCallProvider.notifier).clear();
    ref.read(webRtcServiceProvider).sendEnd(
          targetId: call.senderId,
          conversationId: call.conversationId,
        );
    ref
        .read(chatRepositoryProvider)
        .sendMessageRest(
          call.conversationId,
          WebRTCService.missedCallLog(isVideo: call.isVideo),
          type: 'system',
        )
        // Best-effort: a failed call log must not block declining.
        .ignore();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final call = ref.watch(incomingCallProvider);
    final caller = call == null
        ? ''
        : resolveCallDisplayName(
            ref,
            userId: call.senderId,
            conversationId: call.conversationId,
            fallback: context.l10n.callUnknownCaller,
          );
    return Stack(
      children: [
        child,
        if (call != null)
          Positioned(
            top: MediaQuery.of(context).padding.top + 12,
            left: 12,
            right: 12,
            child: SafeArea(
              child: Material(
                color: Colors.transparent,
                child: _IncomingCallCard(
                  isVideo: call.isVideo,
                  caller: caller,
                  onAccept: () => _accept(ref, call, caller),
                  onDecline: () => _decline(ref, call),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _IncomingCallCard extends StatelessWidget {
  final bool isVideo;
  final String caller;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  const _IncomingCallCard({
    required this.isVideo,
    required this.caller,
    required this.onAccept,
    required this.onDecline,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border:
            Border.all(color: AppTheme.accent(context).withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          Icon(isVideo ? Icons.videocam_rounded : Icons.call_rounded,
              color: AppTheme.accent(context), size: 30),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.callIncoming,
                  style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 16,
                      fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.callIncomingBody(caller),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      color: AppTheme.mutedText(context), fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onDecline,
            icon: Icon(Icons.call_end_rounded,
                color: Theme.of(context).colorScheme.error),
            tooltip: l10n.callDecline,
          ),
          IconButton(
            onPressed: onAccept,
            icon: const Icon(Icons.call_rounded, color: AppTheme.onlineGreen),
            tooltip: l10n.callAccept,
          ),
        ],
      ),
    );
  }
}
