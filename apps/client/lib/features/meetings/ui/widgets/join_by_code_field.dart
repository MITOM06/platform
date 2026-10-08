import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../domain/meeting_code.dart';

/// "Meeting code or link" + Join — mirror of web `JoinByCodeForm`. Accepts any
/// case, spaces, missing dashes or a whole link.
class JoinByCodeField extends StatefulWidget {
  const JoinByCodeField({super.key});

  @override
  State<JoinByCodeField> createState() => _JoinByCodeFieldState();
}

class _JoinByCodeFieldState extends State<JoinByCodeField> {
  final _controller = TextEditingController();
  bool _invalid = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final code = parseMeetingCodeInput(_controller.text);
    if (code == null) {
      setState(() => _invalid = true);
      return;
    }
    context.push(meetingPath(code));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final error = Theme.of(context).colorScheme.error;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Expanded(
            child: PonTextField(
              controller: _controller,
              labelText: l10n.meetingJoinByCodeLabel,
              prefixIcon: Icons.keyboard_rounded,
              textInputAction: TextInputAction.go,
              autofillHints: const [],
              onChanged: (_) {
                if (_invalid) setState(() => _invalid = false);
              },
              onFieldSubmitted: (_) => _submit(),
            ),
          ),
          const SizedBox(width: 8),
          ListenableBuilder(
            listenable: _controller,
            builder: (context, _) => TextButton(
              onPressed: _controller.text.trim().isEmpty ? null : _submit,
              child: Text(l10n.meetingJoinByCode),
            ),
          ),
        ]),
        Padding(
          padding: const EdgeInsets.only(top: 4, left: 4),
          child: Text(
            _invalid ? l10n.meetingCodeInvalid : l10n.meetingJoinByCodePlaceholder,
            style: TextStyle(
                fontSize: 12,
                color: _invalid ? error : AppTheme.mutedText(context)),
          ),
        ),
      ],
    );
  }
}
