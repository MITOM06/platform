import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/config/app_config.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../domain/meeting_code.dart';

/// Copies the shareable web link (`…/meet/{code}`); without a configured web
/// origin it copies the bare code instead. [asButton] = labelled outlined
/// button (detail screen), else an icon (list rows).
class CopyMeetingLink extends StatelessWidget {
  const CopyMeetingLink({super.key, required this.code, this.asButton = false});

  final String code;
  final bool asButton;

  Future<void> _copy(BuildContext context) async {
    final l10n = context.l10n;
    final link = meetingLink(code, AppConfig.webBaseUrl);
    try {
      await Clipboard.setData(ClipboardData(text: link ?? code));
      showInfoSnackBar(
          link == null ? l10n.meetingLinkCodeCopied : l10n.meetingLinkCopied);
    } catch (_) {
      showErrorSnackBar(l10n.meetingCopyFailed);
    }
  }

  @override
  Widget build(BuildContext context) {
    final label = context.l10n.meetingCopyLink;
    if (asButton) {
      return OutlinedButton.icon(
        onPressed: () => _copy(context),
        icon: const Icon(Icons.link_rounded, size: 18),
        label: Text(label),
      );
    }
    return IconButton(
      onPressed: () => _copy(context),
      tooltip: label,
      icon: const Icon(Icons.link_rounded, size: 20),
    );
  }
}
