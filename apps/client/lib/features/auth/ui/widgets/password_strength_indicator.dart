import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

class PasswordStrengthIndicator extends StatelessWidget {
  final String password;
  const PasswordStrengthIndicator({super.key, required this.password});

  int _score() {
    if (password.isEmpty) return 0;
    int s = 0;
    if (password.length >= 8) s++;
    if (password.contains(RegExp(r'[A-Z]')) &&
        password.contains(RegExp(r'[a-z]'))) {
      s++;
    }
    if (password.contains(RegExp(r'[0-9]'))) s++;
    if (password.contains(RegExp(r'[!@#$%^&*]'))) s++;
    return s;
  }

  @override
  Widget build(BuildContext context) {
    if (password.isEmpty) return const SizedBox.shrink();
    final score = _score();
    final colors = [
      Theme.of(context).colorScheme.error,
      Colors.orange,
      Colors.yellow,
      Colors.green,
      Colors.green
    ];
    final barColor = colors[score.clamp(0, 4)];
    final labels = [
      context.l10n.pwStrengthWeak,
      context.l10n.pwStrengthWeak,
      context.l10n.pwStrengthMedium,
      context.l10n.pwStrengthStrong,
      context.l10n.pwStrengthVeryStrong,
    ];
    final checks = [
      (password.length >= 8, context.l10n.pwReqLength),
      (password.contains(RegExp(r'[A-Z]')), context.l10n.pwReqUppercase),
      (password.contains(RegExp(r'[a-z]')), context.l10n.pwReqLowercase),
      (password.contains(RegExp(r'[0-9]')), context.l10n.pwReqDigit),
      (password.contains(RegExp(r'[!@#$%^&*]')), context.l10n.pwReqSpecial),
    ];

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: List.generate(4, (i) {
              return Expanded(
                child: Container(
                  margin: const EdgeInsets.only(right: 4),
                  height: 4,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(2),
                    color: i < score ? barColor : AppTheme.hairline(context),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 6),
          Text(
            labels[score.clamp(0, 4)],
            style: TextStyle(
              fontSize: 12,
              color: barColor,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 6),
          ...checks.map((c) {
            final (passed, label) = c;
            return Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Row(
                children: [
                  Icon(
                    passed
                        ? Icons.check_circle_outline_rounded
                        : Icons.radio_button_unchecked,
                    size: 14,
                    color: passed
                        ? AppTheme.ponAccent
                        : AppTheme.hairline(context),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      color: passed
                          ? AppTheme.mutedText(context)
                          : AppTheme.hairline(context),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
