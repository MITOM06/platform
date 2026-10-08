import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/auth_repository.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../chat/ui/widgets/conversation_avatar.dart';
import '../../domain/display.dart';
import '../../domain/meeting_models.dart';

/// Search people (auth-service) and collect them as chips — mirror of web
/// `InviteePicker`. Names only — never ids or e-mail addresses.
class InviteePicker extends ConsumerStatefulWidget {
  const InviteePicker(
      {super.key, required this.invitees, required this.onChanged, this.error});

  final List<MeetingPerson> invitees;
  final ValueChanged<List<MeetingPerson>> onChanged;
  final String? error;

  @override
  ConsumerState<InviteePicker> createState() => _InviteePickerState();
}

class _InviteePickerState extends ConsumerState<InviteePicker> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String _query = '';
  bool _searching = false;
  bool _failed = false;
  List<UserModel> _results = const [];

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String text) {
    _debounce?.cancel();
    final q = text.trim();
    if (q.isEmpty) {
      setState(() {
        _query = '';
        _results = const [];
        _failed = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 400), () => _search(q));
  }

  Future<void> _search(String q) async {
    setState(() {
      _query = q;
      _searching = true;
    });
    try {
      final found = await ref.read(authRepositoryProvider).searchUsers(q);
      if (!mounted || q != _controller.text.trim()) return;
      setState(() {
        _results = found;
        _failed = false;
      });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  void _add(UserModel u) {
    widget.onChanged([
      ...widget.invitees,
      MeetingPerson(
          userId: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl),
    ]);
    _controller.clear();
    _onChanged('');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final myId = ref.watch(authNotifierProvider.select((s) {
      final v = s.valueOrNull;
      return v is AuthAuthenticated ? v.user.id : '';
    }));
    final chosen = {for (final p in widget.invitees) p.userId};
    final results = _results
        .where((u) => u.id.isNotEmpty && u.id != myId && !chosen.contains(u.id))
        .toList();
    final muted = TextStyle(fontSize: 12, color: AppTheme.mutedText(context));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _controller,
          onChanged: _onChanged,
          autocorrect: false,
          decoration: InputDecoration(
            labelText: l10n.meetingFieldInvitees,
            hintText: l10n.meetingInviteeSearchPlaceholder,
            prefixIcon: const Icon(Icons.search_rounded),
            suffixIcon: _searching
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2)))
                : null,
            errorText: widget.error,
            errorMaxLines: 2,
          ),
        ),
        if (_query.isNotEmpty && !_searching)
          _SearchResults(failed: _failed, results: results, onPick: _add),
        const SizedBox(height: 8),
        Text(
            widget.invitees.isEmpty
                ? l10n.meetingInviteeNone
                : l10n.meetingInviteeCount(widget.invitees.length),
            style: muted),
        if (widget.invitees.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final p in widget.invitees)
              _InviteeChip(
                person: p,
                onRemove: () => widget.onChanged(widget.invitees
                    .where((x) => x.userId != p.userId)
                    .toList()),
              ),
          ]),
        ],
      ],
    );
  }
}

class _InviteeChip extends StatelessWidget {
  const _InviteeChip({required this.person, required this.onRemove});

  final MeetingPerson person;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final name = personName(person, l10n.meetingParticipantFallback);
    return InputChip(
      avatar: ConversationAvatar(
          avatarUrl: person.avatarUrl,
          fallbackLetter: name.characters.first.toUpperCase(),
          size: 24),
      label: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 160),
        child: Text(name, overflow: TextOverflow.ellipsis),
      ),
      onDeleted: onRemove,
      deleteButtonTooltipMessage: l10n.meetingRemoveInvitee(name),
    );
  }
}

class _SearchResults extends StatelessWidget {
  const _SearchResults(
      {required this.failed, required this.results, required this.onPick});

  final bool failed;
  final List<UserModel> results;
  final ValueChanged<UserModel> onPick;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final muted = TextStyle(fontSize: 12, color: AppTheme.mutedText(context));
    if (failed || results.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text(
            failed ? l10n.meetingSearchFailed : l10n.meetingSearchNoResults,
            style: muted),
      );
    }
    return Container(
      margin: const EdgeInsets.only(top: 8),
      constraints: const BoxConstraints(maxHeight: 192),
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.hairline(context)),
        borderRadius: BorderRadius.circular(AppTheme.radiusControl),
      ),
      child: ListView(
        shrinkWrap: true,
        padding: EdgeInsets.zero,
        children: [
          for (final u in results) _ResultTile(user: u, onTap: () => onPick(u)),
        ],
      ),
    );
  }
}

class _ResultTile extends StatelessWidget {
  const _ResultTile({required this.user, required this.onTap});

  final UserModel user;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final name = safeDisplayName(user.displayName, user.id) ??
        context.l10n.meetingParticipantFallback;
    return ListTile(
      dense: true,
      onTap: onTap,
      leading: ConversationAvatar(
          avatarUrl: user.avatarUrl,
          fallbackLetter: name.characters.first.toUpperCase(),
          size: 32),
      title: Text(name, overflow: TextOverflow.ellipsis),
      // Web shows the email under the name (tells namesakes apart).
      subtitle: user.email.isEmpty
          ? null
          : Text(user.email,
              overflow: TextOverflow.ellipsis,
              style:
                  TextStyle(fontSize: 12, color: AppTheme.mutedText(context))),
    );
  }
}
