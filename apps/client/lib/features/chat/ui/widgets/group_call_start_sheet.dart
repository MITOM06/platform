import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/stomp_service.dart';

/// Bottom sheet to start a group call: pick audio/video media and toggle the
/// AI notetaker (starter-only). Publishes `/app/call.start` and lets the
/// `call.started` broadcast bring everyone (including the starter) into the
/// call via the active-call banner / join flow.
class GroupCallStartSheet extends ConsumerStatefulWidget {
  final String conversationId;
  final bool initialVideo;

  const GroupCallStartSheet({
    super.key,
    required this.conversationId,
    this.initialVideo = false,
  });

  static Future<void> show(
    BuildContext context, {
    required String conversationId,
    bool initialVideo = false,
  }) {
    return showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.darkSurface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => GroupCallStartSheet(
        conversationId: conversationId,
        initialVideo: initialVideo,
      ),
    );
  }

  @override
  ConsumerState<GroupCallStartSheet> createState() =>
      _GroupCallStartSheetState();
}

class _GroupCallStartSheetState extends ConsumerState<GroupCallStartSheet> {
  late bool _video = widget.initialVideo;
  bool _aiNotetaker = false;

  void _start() {
    ref.read(stompServiceProvider.notifier).sendRawMessage(
          destination: '/app/call.start',
          body: jsonEncode({
            'conversationId': widget.conversationId,
            'media': _video ? 'video' : 'audio',
            'aiNotetaker': _aiNotetaker,
          }),
        );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.groupCallStartTitle,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _MediaChoice(
                  icon: Icons.call,
                  label: l10n.groupCallAudio,
                  selected: !_video,
                  onTap: () => setState(() => _video = false),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _MediaChoice(
                  icon: Icons.videocam,
                  label: l10n.groupCallVideo,
                  selected: _video,
                  onTap: () => setState(() => _video = true),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _aiNotetaker,
            activeThumbColor: const Color(0xFFB47FFF),
            onChanged: (v) => setState(() => _aiNotetaker = v),
            title: Row(
              children: [
                const Icon(Icons.auto_awesome,
                    color: Color(0xFFB47FFF), size: 18),
                const SizedBox(width: 8),
                Text(l10n.groupCallNotetakerToggle,
                    style: const TextStyle(color: Colors.white, fontSize: 15)),
              ],
            ),
            subtitle: Text(
              l10n.groupCallNotetakerHint,
              style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.5), fontSize: 12),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _start,
              icon: const Icon(Icons.video_call),
              label: Text(l10n.groupCallStartAction),
            ),
          ),
        ],
      ),
    );
  }
}

class _MediaChoice extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _MediaChoice({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: selected
              ? AppTheme.ponCyan.withValues(alpha: 0.18)
              : Colors.white.withValues(alpha: 0.05),
          border: Border.all(
            color: selected
                ? AppTheme.ponCyan
                : AppTheme.darkBorder.withValues(alpha: 0.6),
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(icon,
                color: selected ? AppTheme.ponCyan : Colors.white70, size: 28),
            const SizedBox(height: 6),
            Text(label,
                style: TextStyle(
                    color: selected ? Colors.white : Colors.white70,
                    fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
