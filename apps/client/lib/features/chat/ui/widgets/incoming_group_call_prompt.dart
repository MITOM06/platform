import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/call_name_resolver.dart';
import '../../domain/group_call_controller.dart';
import '../../domain/group_call_signaling.dart';
import '../../domain/group_call_state.dart';

/// Global overlay shown while a `call-ring` incoming group call is pending.
/// Accept → publish call.join (via controller) + open the call screen.
/// Decline → just clear the prompt (ignore, per §2).
///
/// Mounted once via MaterialApp.router's `builder` so it floats above any
/// route.
class IncomingGroupCallPrompt extends ConsumerWidget {
  final Widget child;
  const IncomingGroupCallPrompt({super.key, required this.child});

  Future<void> _accept(BuildContext context, WidgetRef ref,
      IncomingGroupCall call) async {
    ref.read(incomingGroupCallNotifierProvider.notifier).clear();
    try {
      await ref.read(groupCallControllerProvider.notifier).join(
            callId: call.callId,
            conversationId: call.conversationId,
            isVideo: call.isVideo,
            aiNotetaker: call.aiNotetaker,
            isStarter: false,
          );
      ref.read(appRouterProvider).push('/group-call');
    } catch (_) {
      // Media error already surfaces on the call screen; ignore here.
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final call = ref.watch(incomingGroupCallNotifierProvider);
    // chat-service is userId-only: startedByName carries the raw ObjectId.
    // Resolve it to a human name (nickname → cached profile) client-side so it
    // stays consistent with the rest of chat, falling back gracefully.
    final caller = call == null
        ? ''
        : resolveCallDisplayName(
            ref,
            userId: call.startedById,
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
                child: _PromptCard(
                  call: call,
                  caller: caller,
                  onAccept: () => _accept(context, ref, call),
                  onDecline: () => ref
                      .read(incomingGroupCallNotifierProvider.notifier)
                      .clear(),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _PromptCard extends StatelessWidget {
  final IncomingGroupCall call;
  final String caller;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  const _PromptCard({
    required this.call,
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
        color: AppTheme.darkSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.ponCyan.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          Icon(call.isVideo ? Icons.videocam : Icons.groups,
              color: AppTheme.ponCyan, size: 30),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.incomingGroupCallTitle,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.incomingGroupCallBody(caller),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.6),
                      fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onDecline,
            icon: const Icon(Icons.call_end, color: Colors.red),
            tooltip: l10n.callDecline,
          ),
          IconButton(
            onPressed: onAccept,
            icon: const Icon(Icons.call, color: AppTheme.onlineGreen),
            tooltip: l10n.callAccept,
          ),
        ],
      ),
    );
  }
}
