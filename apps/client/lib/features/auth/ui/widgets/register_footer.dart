import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
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
              const Expanded(child: Divider(color: Colors.white24)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  context.l10n.orContinueWith,
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.5), fontSize: 12),
                ),
              ),
              const Expanded(child: Divider(color: Colors.white24)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        StaggeredEntrance(
          index: 3,
          child: OutlinedButton.icon(
            onPressed: onGoogle,
            icon: const Text('G',
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: Color(0xFF4285F4))),
            label: Text(context.l10n.registerWithGoogle),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: BorderSide(color: Colors.white.withValues(alpha: 0.3)),
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
                style: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
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
