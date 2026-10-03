import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

/// "I agree to the Privacy Policy and Terms of Service" checkbox row. Both
/// links open the in-app `/legal` screen. Used by the invitation accept flow,
/// where agreeing is required before either Google or password accept.
class TermsAgreementRow extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;

  const TermsAgreementRow({
    super.key,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 24,
          width: 24,
          child: Checkbox(
            value: value,
            onChanged: (v) => onChanged(v ?? false),
            activeColor: AppTheme.accent(context),
            side: BorderSide(color: AppTheme.mutedText(context)),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: GestureDetector(
            onTap: () => onChanged(!value),
            child: RichText(
              text: TextSpan(
                style: TextStyle(
                  color: AppTheme.mutedText(context),
                  fontSize: 12,
                ),
                children: _spans(context),
              ),
            ),
          ),
        ),
      ],
    );
  }

  List<InlineSpan> _spans(BuildContext context) {
    final text = context.l10n.agreeToTerms('__PRIVACY__', '__TERMS__');
    final pattern = RegExp(r'(__PRIVACY__|__TERMS__)');
    final parts = text.split(pattern);
    final matches = pattern.allMatches(text).toList();

    final spans = <InlineSpan>[];
    for (int i = 0; i < parts.length; i++) {
      if (parts[i].isNotEmpty) spans.add(TextSpan(text: parts[i]));
      if (i < matches.length) {
        final isPrivacy = matches[i].group(0) == '__PRIVACY__';
        spans.add(WidgetSpan(
          alignment: PlaceholderAlignment.baseline,
          baseline: TextBaseline.alphabetic,
          child: GestureDetector(
            // Both Privacy & Terms live on the native in-app /legal screen.
            onTap: () => context.push('/legal'),
            child: Text(
              isPrivacy
                  ? context.l10n.privacyPolicy
                  : context.l10n.termsOfService,
              style: TextStyle(
                color: AppTheme.accent(context),
                fontWeight: FontWeight.w600,
                decoration: TextDecoration.underline,
                decorationColor: AppTheme.accent(context),
              ),
            ),
          ),
        ));
      }
    }
    return spans;
  }
}
