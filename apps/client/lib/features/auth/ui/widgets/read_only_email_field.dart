import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';

/// Disabled-looking "Email" field showing the account / invited address the
/// user will sign in with. Used by the invitation accept and set-password
/// screens.
class ReadOnlyEmailField extends StatelessWidget {
  final String email;
  const ReadOnlyEmailField({super.key, required this.email});

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: InputDecoration(
        labelText: context.l10n.fieldEmail,
        prefixIcon: const Icon(Icons.email_rounded),
        enabled: false,
      ),
      child: Text(
        email,
        style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
      ),
    );
  }
}
