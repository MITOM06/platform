import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/invitation_preview.dart';

/// "Have an invitation link?" — lets an invitee paste the link from the
/// invitation email (full URL, app deep link or bare token) and opens
/// `/invite/<token>`. Needed because invite emails link to the web page and
/// there are no universal links yet.
class InviteLinkDialog extends StatefulWidget {
  const InviteLinkDialog({super.key});

  static Future<void> show(BuildContext context) => showDialog<void>(
        context: context,
        builder: (_) => const InviteLinkDialog(),
      );

  @override
  State<InviteLinkDialog> createState() => _InviteLinkDialogState();
}

class _InviteLinkDialogState extends State<InviteLinkDialog> {
  final _controller = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _open() {
    final token = extractInviteToken(_controller.text);
    if (token == null) {
      setState(() => _error = context.l10n.inviteLinkInvalid);
      return;
    }
    final router = GoRouter.of(context);
    Navigator.of(context).pop();
    router.go('/invite/$token');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.inviteLinkDialogTitle),
      content: TextField(
        key: const Key('inviteLinkField'),
        controller: _controller,
        autofocus: true,
        keyboardType: TextInputType.url,
        textInputAction: TextInputAction.go,
        onSubmitted: (_) => _open(),
        onChanged: (_) {
          if (_error != null) setState(() => _error = null);
        },
        decoration: InputDecoration(
          hintText: l10n.inviteLinkDialogHint,
          errorText: _error,
          errorMaxLines: 2,
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.inviteCancel),
        ),
        TextButton(
          onPressed: _open,
          child: Text(l10n.inviteOpen),
        ),
      ],
    );
  }
}
