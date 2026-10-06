import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../utils/mfa_code.dart';

/// The 10 single-use backup codes, shown exactly once (after enrollment, or
/// after "Regenerate backup codes" in Settings → Security): the codes, Copy,
/// and a required "I saved my backup codes" checkbox before [onConfirm] is
/// enabled. Copy uses Flutter's built-in [Clipboard] (no share package).
/// [isLoading] shows progress on the confirm button and freezes the checkbox
/// while an async [onConfirm] (e.g. enroll complete) runs.
///
/// Intrinsic-size friendly (no grid / list viewport) so it also fits inside
/// an `AlertDialog`.
class BackupCodesPanel extends StatefulWidget {
  final List<String> codes;
  final String confirmLabel;
  final VoidCallback onConfirm;
  final bool isLoading;

  const BackupCodesPanel({
    super.key,
    required this.codes,
    required this.confirmLabel,
    required this.onConfirm,
    this.isLoading = false,
  });

  @override
  State<BackupCodesPanel> createState() => _BackupCodesPanelState();
}

class _BackupCodesPanelState extends State<BackupCodesPanel> {
  bool _saved = false;

  Future<void> _copy() async {
    final message = context.l10n.mfaCodesCopied;
    await Clipboard.setData(
        ClipboardData(text: backupCodesAsText(widget.codes)));
    showInfoSnackBar(message);
  }

  void _setSaved(bool value) {
    if (widget.isLoading) return;
    setState(() => _saved = value);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final codes = widget.codes;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          key: const ValueKey('mfa-backup-codes'),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppTheme.hairline(context)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < codes.length; i += 2)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Expanded(child: _Code(codes[i], color: onSurface)),
                      Expanded(
                        child: i + 1 < codes.length
                            ? _Code(codes[i + 1], color: onSurface)
                            : const SizedBox.shrink(),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            key: const ValueKey('mfa-copy-codes'),
            onPressed: _copy,
            icon: const Icon(Icons.copy_rounded, size: 18),
            label: Text(l10n.mfaCopyCodes),
          ),
        ),
        const SizedBox(height: 4),
        InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => _setSaved(!_saved),
          child: Row(
            children: [
              Checkbox(
                key: const ValueKey('mfa-saved-checkbox'),
                value: _saved,
                onChanged: (v) => _setSaved(v ?? false),
              ),
              Expanded(
                child: Text(
                  l10n.mfaSavedCheckbox,
                  style: TextStyle(color: onSurface, fontSize: 14),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        PonButton(
          key: const ValueKey('mfa-codes-continue'),
          // Required acknowledgement: the codes are never shown again.
          onPressed: _saved ? widget.onConfirm : null,
          isLoading: widget.isLoading,
          child: Text(widget.confirmLabel),
        ),
      ],
    );
  }
}

class _Code extends StatelessWidget {
  final String code;
  final Color color;
  const _Code(this.code, {required this.color});

  @override
  Widget build(BuildContext context) {
    return Text(
      code,
      textAlign: TextAlign.center,
      style: TextStyle(
        color: color,
        fontFamily: AppTheme.fontMono,
        fontSize: 16,
        letterSpacing: 1,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}
