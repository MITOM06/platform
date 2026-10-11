import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

/// The phone-verification sheet's primary button, with a spinner while
/// [busy].
class PhoneSheetAction extends StatelessWidget {
  const PhoneSheetAction({
    super.key,
    required this.label,
    required this.busy,
    required this.onPressed,
  });

  final String label;
  final bool busy;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final onAccent = Theme.of(context).colorScheme.onPrimary;
    return FilledButton(
      style: FilledButton.styleFrom(
        backgroundColor: AppTheme.accent(context),
        foregroundColor: onAccent,
      ),
      onPressed: onPressed,
      child: busy
          ? SizedBox(
              height: 18,
              width: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation(onAccent),
              ),
            )
          : Text(label),
    );
  }
}
