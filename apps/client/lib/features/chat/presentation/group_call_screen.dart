import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../domain/call_name_resolver.dart';
import '../domain/group_call_controller.dart';
import '../domain/group_call_state.dart';
import '../ui/widgets/call_tile.dart';

/// Full-screen multi-tile group call UI: a grid of video tiles / audio
/// avatars, mic+cam toggles, leave, the live roster, and an "AI is taking
/// notes" banner when the notetaker is on.
class GroupCallScreen extends ConsumerStatefulWidget {
  const GroupCallScreen({super.key});

  @override
  ConsumerState<GroupCallScreen> createState() => _GroupCallScreenState();
}

class _GroupCallScreenState extends ConsumerState<GroupCallScreen> {
  Future<void> _leave() async {
    await ref.read(groupCallControllerProvider.notifier).leave();
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final call = ref.watch(groupCallControllerProvider);
    final controller = ref.read(groupCallControllerProvider.notifier);

    // If the call ended/was left elsewhere, close this screen.
    ref.listen(groupCallControllerProvider, (prev, next) {
      if (prev?.isActive == true && !next.isActive && mounted) {
        context.pop();
      }
    });

    if (!call.isActive) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: CircularProgressIndicator(color: Colors.white)),
      );
    }

    final auth = ref.watch(authNotifierProvider).valueOrNull;
    final selfId = auth is AuthAuthenticated ? auth.user.id : '';
    final selfName =
        auth is AuthAuthenticated ? auth.user.displayName : context.l10n.you;

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            _Header(call: call),
            if (call.aiNotetaker) const _NotetakerBanner(),
            Expanded(
              child: _CallGrid(
                call: call,
                controller: controller,
                selfId: selfId,
                selfName: selfName,
              ),
            ),
            _Controls(
              call: call,
              onToggleMic: controller.toggleMic,
              onToggleCam: controller.toggleCam,
              onLeave: _leave,
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final GroupCallState call;
  const _Header({required this.call});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Column(
        children: [
          Text(
            context.l10n.groupCallTitle,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 2),
          Text(
            context.l10n.groupCallParticipants(call.presentCount),
            style: TextStyle(
                color: Colors.white.withValues(alpha: 0.6), fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _NotetakerBanner extends StatelessWidget {
  const _NotetakerBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF2D1B69).withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFB47FFF).withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.auto_awesome, color: Color(0xFFB47FFF), size: 18),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              context.l10n.groupCallNotetakerActive,
              style: const TextStyle(
                  color: Color(0xFFD6BBFF),
                  fontSize: 13,
                  fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}

class _CallGrid extends ConsumerWidget {
  final GroupCallState call;
  final GroupCallController controller;
  final String selfId;
  final String selfName;

  const _CallGrid({
    required this.call,
    required this.controller,
    required this.selfId,
    required this.selfName,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tiles = <Widget>[
      CallTile(
        renderer: controller.localRenderer,
        hasVideo: call.isVideo && call.camEnabled,
        label: '$selfName (${context.l10n.you})',
        mirror: true,
        muted: !call.micEnabled,
      ),
    ];

    final remotePeers = controller.remotePeers;
    for (final p in call.roster.where((p) => p.isPresent)) {
      if (p.userId == selfId) continue;
      final peer = remotePeers[p.userId];
      // chat-service is userId-only: p.displayName carries the raw ObjectId.
      // Resolve it to a human name (nickname → cached profile) client-side,
      // falling back gracefully while the profile loads.
      final label = resolveCallDisplayName(
        ref,
        userId: p.userId,
        conversationId: call.conversationId,
        fallback: context.l10n.callUnknownCaller,
      );
      tiles.add(CallTile(
        renderer: peer?.renderer,
        hasVideo: call.isVideo && (peer?.hasVideo ?? false),
        label: label,
      ));
    }

    final cols = tiles.length <= 1 ? 1 : (tiles.length <= 4 ? 2 : 3);
    return Padding(
      padding: const EdgeInsets.all(12),
      child: GridView.count(
        crossAxisCount: cols,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 3 / 4,
        children: tiles,
      ),
    );
  }
}

class _Controls extends StatelessWidget {
  final GroupCallState call;
  final VoidCallback onToggleMic;
  final VoidCallback onToggleCam;
  final VoidCallback onLeave;

  const _Controls({
    required this.call,
    required this.onToggleMic,
    required this.onToggleCam,
    required this.onLeave,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _RoundButton(
            icon: call.micEnabled ? Icons.mic : Icons.mic_off,
            active: call.micEnabled,
            onPressed: onToggleMic,
            tooltip: context.l10n.callToggleMic,
          ),
          if (call.isVideo) ...[
            const SizedBox(width: 18),
            _RoundButton(
              icon: call.camEnabled ? Icons.videocam : Icons.videocam_off,
              active: call.camEnabled,
              onPressed: onToggleCam,
              tooltip: context.l10n.callToggleCam,
            ),
          ],
          const SizedBox(width: 18),
          FloatingActionButton(
            heroTag: 'leave_group_call',
            backgroundColor: Colors.red,
            onPressed: onLeave,
            tooltip: context.l10n.callLeave,
            child: const Icon(Icons.call_end, color: Colors.white, size: 30),
          ),
        ],
      ),
    );
  }
}

class _RoundButton extends StatelessWidget {
  final IconData icon;
  final bool active;
  final VoidCallback onPressed;
  final String tooltip;

  const _RoundButton({
    required this.icon,
    required this.active,
    required this.onPressed,
    required this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: active
            ? Colors.white.withValues(alpha: 0.15)
            : Colors.white.withValues(alpha: 0.35),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Icon(icon, color: Colors.white, size: 26),
          ),
        ),
      ),
    );
  }
}
