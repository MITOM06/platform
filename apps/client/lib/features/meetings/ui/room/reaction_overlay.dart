import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../state/meeting_room_providers.dart';
import '../../state/meeting_room_state.dart';
import 'room_controls.dart';

/// Screen readers hear at most one reaction per this long.
const _announceGap = Duration(seconds: 2);

/// Reactions floating up over the stage (never catches touches) — mirror of
/// web `ReactionOverlay`. Only this widget rebuilds when reactions change.
class ReactionOverlay extends ConsumerStatefulWidget {
  const ReactionOverlay({super.key});

  @override
  ConsumerState<ReactionOverlay> createState() => _ReactionOverlayState();
}

class _ReactionOverlayState extends ConsumerState<ReactionOverlay> {
  DateTime? _lastAnnounced;

  void _announce(List<FloatingReaction>? prev, List<FloatingReaction> next) {
    if (next.isEmpty) return;
    final newest = next.last;
    if (newest.mine || (prev?.any((r) => r.id == newest.id) ?? false)) return;
    final now = DateTime.now();
    final last = _lastAnnounced;
    if (last != null && now.difference(last) < _announceGap) return;
    _lastAnnounced = now;
    final l = context.l10n;
    final text = l.meetingReactionAria(
        newest.name ?? l.meetingParticipantFallback, newest.emoji);
    SemanticsService.sendAnnouncement(
        View.of(context), text, Directionality.of(context));
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(meetingRoomStoreProvider.select((s) => s.reactions), _announce);
    final reactions =
        ref.watch(meetingRoomStoreProvider.select((s) => s.reactions));
    return ExcludeSemantics(
      child: Stack(children: [
        for (final r in reactions) _Bubble(key: ValueKey(r.id), r: r),
      ]),
    );
  }
}

class _Bubble extends StatefulWidget {
  const _Bubble({super.key, required this.r});

  final FloatingReaction r;

  @override
  State<_Bubble> createState() => _BubbleState();
}

class _BubbleState extends State<_Bubble> with SingleTickerProviderStateMixin {
  late final AnimationController _anim;
  bool _still = false;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(vsync: this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still = MediaQuery.disableAnimationsOf(context);
    if (_anim.isAnimating || _anim.value > 0) return;
    _still = still;
    _anim.duration = Duration(seconds: still ? 2 : 3);
    _anim.forward();
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final r = widget.r;
    final name =
        r.mine ? l.meetingYou : (r.name ?? l.meetingParticipantFallback);
    return AnimatedBuilder(
      animation: _anim,
      builder: (context, child) {
        final t = _anim.value;
        final rise = _still ? 0.0 : t * MediaQuery.sizeOf(context).height * 0.5;
        final opacity = _still ? (t < 0.8 ? 1.0 : (1 - t) * 5) : 1 - t;
        return Positioned(
          left: 16.0 + (r.id * 37) % 96,
          bottom: 16 + rise,
          child: Opacity(opacity: opacity.clamp(0.0, 1.0), child: child),
        );
      },
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(r.emoji, style: const TextStyle(fontSize: 30)),
        const SizedBox(height: 4),
        Container(
          constraints: const BoxConstraints(maxWidth: 112),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
              color: kStagePill, borderRadius: BorderRadius.circular(6)),
          child: Text(name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontSize: 12)),
        ),
      ]),
    );
  }
}
