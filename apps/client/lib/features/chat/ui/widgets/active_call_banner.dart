import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/active_call_provider.dart';
import '../../domain/group_call_controller.dart';

/// In-chat banner shown when a group call is active in the conversation:
/// "Group call · N joined · Join". Tapping Join publishes call.join (via the
/// controller) and opens the group call screen. Hidden once the user is in
/// the call.
class ActiveCallBanner extends ConsumerWidget {
  final String conversationId;
  const ActiveCallBanner({super.key, required this.conversationId});

  Future<void> _join(BuildContext context, WidgetRef ref,
      ActiveCallInfo info) async {
    try {
      await ref.read(groupCallControllerProvider.notifier).join(
            callId: info.callId,
            conversationId: info.conversationId,
            isVideo: info.isVideo,
            aiNotetaker: info.aiNotetaker,
            isStarter: false,
          );
      if (context.mounted) context.push('/group-call');
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.callMediaError)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final info = ref.watch(activeCallsProvider)[conversationId];
    final activeCall = ref.watch(groupCallControllerProvider);
    if (info == null) return const SizedBox.shrink();
    // Already in this call → no banner (the call screen is showing).
    if (activeCall.callId == info.callId && activeCall.joined) {
      return const SizedBox.shrink();
    }

    return Material(
      color: AppTheme.ponCyan.withValues(alpha: 0.12),
      child: InkWell(
        onTap: () => _join(context, ref, info),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              const Icon(Icons.groups, color: AppTheme.ponCyan, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  context.l10n.activeCallBanner(info.participantCount),
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w500),
                ),
              ),
              FilledButton(
                onPressed: () => _join(context, ref, info),
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.ponCyan,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 6),
                  minimumSize: const Size(0, 32),
                ),
                child: Text(context.l10n.callJoin),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
