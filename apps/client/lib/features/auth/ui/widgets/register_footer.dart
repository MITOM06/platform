import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/google_logo_icon.dart';
import '../../../../core/widgets/motion_widgets.dart';

/// Bottom section of the register screen: the "or continue with" divider, the
/// Google OAuth button, and the back-to-login link. Extracted from
/// `register_screen.dart` purely to keep that file under the 400-line limit —
/// no behaviour change. [onGoogle] runs the screen's OAuth launcher.
class RegisterFooter extends StatelessWidget {
  final VoidCallback onGoogle;

  const RegisterFooter({super.key, required this.onGoogle});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // OAuth divider
        StaggeredEntrance(
          index: 2,
          child: Row(
            children: [
              Expanded(child: Divider(color: AppTheme.hairline(context))),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  context.l10n.orContinueWith,
                  style: TextStyle(
                      color: AppTheme.mutedText(context), fontSize: 12),
                ),
              ),
              Expanded(child: Divider(color: AppTheme.hairline(context))),
            ],
          ),
        ),
        const SizedBox(height: 12),
        StaggeredEntrance(
          index: 3,
          child: OutlinedButton.icon(
            onPressed: onGoogle,
            icon: const GoogleLogoIcon(size: 18),
            label: Text(context.l10n.registerWithGoogle),
            style: OutlinedButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.onSurface,
              side: BorderSide(color: AppTheme.hairline(context)),
            ),
          ),
        ),

        // Back to login
        StaggeredEntrance(
          index: 4,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                context.l10n.haveAccount,
                style: TextStyle(color: AppTheme.mutedText(context)),
              ),
              TextButton(
                onPressed: () => context.go('/login'),
                child: Text(context.l10n.loginLink),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
