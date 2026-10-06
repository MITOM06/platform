import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart' show launchUrl, LaunchMode;
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../domain/mfa_models.dart';

/// The authenticator-app setup material of an enrollment: the server-made QR
/// (`Image.memory` of the PNG data URL), "Open in authenticator app" (a QR on
/// this phone's own screen can't be scanned by it — the `otpauth://` link adds
/// the account directly), and the base32 key for manual entry with Copy.
class MfaSecretCard extends StatelessWidget {
  final MfaEnrollment enrollment;
  const MfaSecretCard({super.key, required this.enrollment});

  /// "ABCD EFGH IJKL …" — easier to read off and type into the app.
  static String groupedSecret(String secret) {
    final buf = StringBuffer();
    for (var i = 0; i < secret.length; i++) {
      if (i > 0 && i % 4 == 0) buf.write(' ');
      buf.write(secret[i]);
    }
    return buf.toString();
  }

  Future<void> _openInApp(BuildContext context) async {
    final message = context.l10n.mfaEnrollNoApp;
    var opened = false;
    try {
      opened = await launchUrl(
        Uri.parse(enrollment.otpauthUrl),
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {
      opened = false;
    }
    if (!opened) showErrorSnackBar(message);
  }

  Future<void> _copyKey(BuildContext context) async {
    final message = context.l10n.mfaKeyCopied;
    await Clipboard.setData(ClipboardData(text: enrollment.secret));
    showInfoSnackBar(message);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final muted = AppTheme.mutedText(context);
    final qr = enrollment.qrPngBytes;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (qr != null) ...[
          Center(
            child: Container(
              key: const ValueKey('mfa-qr'),
              // QR codes need a light quiet zone, also in dark mode.
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Image.memory(
                qr,
                width: 184,
                height: 184,
                filterQuality: FilterQuality.none,
                gaplessPlayback: true,
                semanticLabel: l10n.mfaQrSemantic,
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (enrollment.otpauthUrl.isNotEmpty)
          OutlinedButton.icon(
            key: const ValueKey('mfa-open-app'),
            onPressed: () => _openInApp(context),
            icon: const Icon(Icons.open_in_new_rounded, size: 18),
            label: Text(l10n.mfaEnrollOpenApp),
            style: OutlinedButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.onSurface,
              side: BorderSide(color: AppTheme.hairline(context)),
            ),
          ),
        const SizedBox(height: 16),
        Text(l10n.mfaEnrollManualKey,
            style: TextStyle(color: muted, fontSize: 12)),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.only(left: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppTheme.hairline(context)),
          ),
          child: Row(
            children: [
              Expanded(
                child: SelectableText(
                  groupedSecret(enrollment.secret),
                  key: const ValueKey('mfa-secret'),
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontFamily: AppTheme.fontMono,
                    fontSize: 14,
                    letterSpacing: 1,
                  ),
                ),
              ),
              IconButton(
                key: const ValueKey('mfa-copy-key'),
                tooltip: l10n.mfaCopyKey,
                icon: Icon(Icons.copy_rounded, color: muted, size: 20),
                onPressed: () => _copyKey(context),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
