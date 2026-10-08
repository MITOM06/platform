import 'package:flutter/material.dart';

import '../../../chat/ui/widgets/conversation_avatar.dart';

// The stage is "content" (video), not chrome: a fixed dark background like the
// call screen, white text on video labels. Everything else uses theme tokens.

/// Stage background.
const kStageBackground = Color(0xFF0A0A0A);

/// A tile without video, the "+N" tile and the presenting block.
const kStageTile = Color(0xFF171717);

/// Label / badge pills over video.
final kStagePill = Colors.black.withValues(alpha: 0.55);

/// Round 48 dp room control (touch target ≥ 44). Neutral when on, error when a
/// media toggle is off (like Meet — owner decision 6), primary when [active].
class RoomRoundButton extends StatelessWidget {
  const RoomRoundButton({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.toggled,
    this.danger = false,
    this.active = false,
    this.dot = false,
  });

  final IconData icon;

  /// Also the accessible name.
  final String tooltip;
  final VoidCallback? onPressed;

  /// Announced as a toggle when set.
  final bool? toggled;
  final bool danger;
  final bool active;

  /// Small attention dot (unread chat, people waiting).
  final bool dot;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final (bg, fg) = danger
        ? (cs.error, cs.onError)
        : active
            ? (cs.primary, cs.onPrimary)
            : (cs.surfaceContainerHighest, cs.onSurface);
    final button = IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      icon: Icon(icon, size: 22),
      constraints: const BoxConstraints.tightFor(width: 48, height: 48),
      style: IconButton.styleFrom(
        backgroundColor: bg,
        foregroundColor: fg,
        disabledBackgroundColor: bg.withValues(alpha: 0.5),
        disabledForegroundColor: fg.withValues(alpha: 0.5),
      ),
    );
    final withDot = !dot
        ? button
        : Stack(clipBehavior: Clip.none, children: [
            button,
            Positioned(
              top: 2,
              right: 2,
              child: Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                    color: cs.primary,
                    shape: BoxShape.circle,
                    border: Border.all(color: cs.surface, width: 2)),
              ),
            ),
          ]);
    final t = toggled;
    return t == null ? withDot : Semantics(toggled: t, child: withDot);
  }
}

/// First letter of an already-humanized name ('?' when empty).
String initialOf(String name) {
  final t = name.trim();
  return t.isEmpty ? '?' : t.characters.first.toUpperCase();
}

/// Photo or initial of a room participant (never their id).
class RoomAvatar extends StatelessWidget {
  const RoomAvatar(
      {super.key, required this.name, this.avatarUrl, this.size = 32});

  final String name;
  final String? avatarUrl;
  final double size;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
        child: ConversationAvatar(
            avatarUrl: avatarUrl, fallbackLetter: initialOf(name), size: size),
      );
}
