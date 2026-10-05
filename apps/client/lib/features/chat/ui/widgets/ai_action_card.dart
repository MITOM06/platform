import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../integrations/state/integrations_provider.dart';
import '../../../integrations/utils/connector_labels.dart';
import '../../domain/ai_action_card_logic.dart';
import '../../domain/ai_actions_provider.dart';
import '../../domain/chat_misc_providers.dart';
import '../../domain/chat_state.dart';

/// One confirmation card per sensitive action the AI is holding
/// (CONTRACTS-ROUND2 §F2), rendered inside the AI bubble — while it streams
/// (`AI_ACTION_PENDING`) and once persisted (`pendingActions[]`).
class AiActionCards extends StatelessWidget {
  final List<AiPendingAction> actions;
  const AiActionCards({super.key, required this.actions});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final a in actions)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: AiActionCard(key: ValueKey(a.id), action: a),
          ),
      ],
    );
  }
}

class AiActionCard extends ConsumerStatefulWidget {
  final AiPendingAction action;
  const AiActionCard({super.key, required this.action});

  @override
  ConsumerState<AiActionCard> createState() => _AiActionCardState();
}

class _AiActionCardState extends ConsumerState<AiActionCard> {
  /// Flips the card to "expired" the moment `expiresAt` passes.
  Timer? _expiry;

  @override
  void initState() {
    super.initState();
    _armExpiry();
  }

  @override
  void didUpdateWidget(covariant AiActionCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.action.expiresAt != widget.action.expiresAt) _armExpiry();
  }

  @override
  void dispose() {
    _expiry?.cancel();
    super.dispose();
  }

  void _armExpiry() {
    _expiry?.cancel();
    final expires = widget.action.expiresAt;
    if (expires == null) return;
    final left = expires.difference(DateTime.now());
    if (left.isNegative) return;
    _expiry = Timer(left + const Duration(milliseconds: 50), () {
      if (mounted) setState(() {});
    });
  }

  Future<void> _resolve({required bool confirm}) async {
    final l10n = context.l10n;
    final notifier = ref.read(aiActionsProvider.notifier);
    final error = confirm
        ? await notifier.confirm(widget.action.id)
        : await notifier.cancel(widget.action.id);
    if (error != null) showErrorSnackBar(aiActionErrorText(l10n, error));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final action = widget.action;
    final auth = ref.watch(authNotifierProvider).valueOrNull;
    final me = auth is AuthAuthenticated ? auth.user.id : null;
    final local = ref.watch(
        aiActionsProvider.select((s) => s.local[action.id]));
    final busy = ref.watch(
        aiActionsProvider.select((s) => s.inFlight.contains(action.id)));
    final kind = actionCardKind(action, me: me, now: DateTime.now(), local: local);
    final names = ref.watch(connectorNamesProvider);
    final connector = connectorDisplayName(l10n, action.provider, names: names);
    final muted = AppTheme.mutedText(context);
    final onSurface = Theme.of(context).colorScheme.onSurface;

    return PonCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.verified_user_outlined, size: 18, color: muted),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(aiActionTitle(l10n, action),
                          style: TextStyle(
                              color: onSurface,
                              fontSize: 14,
                              fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text(l10n.aiActionVia(connector),
                          style: TextStyle(color: muted, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
            ..._detailRows(context, action),
            const SizedBox(height: 10),
            if (kind == ActionCardKind.actionable)
              _Buttons(
                busy: busy,
                onCancel: () => _resolve(confirm: false),
                onConfirm: () => _resolve(confirm: true),
              )
            else
              _StatusLine(kind: kind, requesterId: action.requesterId),
          ],
        ),
      ),
    );
  }

  List<Widget> _detailRows(BuildContext context, AiPendingAction action) {
    final l10n = context.l10n;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final muted = AppTheme.mutedText(context);
    final onSurface = Theme.of(context).colorScheme.onSurface;
    return [
      for (final line in actionSummaryLines(action))
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 72,
                child: Text(_fieldLabel(l10n, line.field),
                    style: TextStyle(color: muted, fontSize: 12)),
              ),
              Expanded(
                child: Text(
                  line.field == ActionSummaryField.when
                      ? formatActionWhen(line.value, line.end, locale)
                      : line.value,
                  style: TextStyle(color: onSurface, fontSize: 12),
                ),
              ),
            ],
          ),
        ),
    ];
  }
}

class _Buttons extends StatelessWidget {
  final bool busy;
  final VoidCallback onCancel;
  final VoidCallback onConfirm;
  const _Buttons({
    required this.busy,
    required this.onCancel,
    required this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: busy ? null : onCancel,
            child: Text(l10n.aiActionCancel),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: PonButton(
            onPressed: busy ? null : onConfirm,
            isLoading: busy,
            child: Text(l10n.aiActionConfirm),
          ),
        ),
      ],
    );
  }
}

class _StatusLine extends ConsumerWidget {
  final ActionCardKind kind;
  final String? requesterId;
  const _StatusLine({required this.kind, required this.requesterId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final muted = AppTheme.mutedText(context);
    final (IconData icon, String text, Color color) = switch (kind) {
      ActionCardKind.confirmed => (
          Icons.check_circle_outline_rounded,
          l10n.aiActionStatusConfirmed,
          muted
        ),
      ActionCardKind.cancelled =>
        (Icons.block_rounded, l10n.aiActionStatusCancelled, muted),
      ActionCardKind.failed =>
        (Icons.error_outline_rounded, l10n.aiActionStatusFailed, scheme.error),
      ActionCardKind.expired =>
        (Icons.timer_off_outlined, l10n.aiActionStatusExpired, muted),
      ActionCardKind.handled =>
        (Icons.done_all_rounded, l10n.aiActionStatusHandled, muted),
      ActionCardKind.waiting || ActionCardKind.actionable => (
          Icons.hourglass_empty_rounded,
          l10n.aiActionWaitingFor(_requesterName(ref, l10n)),
          muted
        ),
    };
    return Row(
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 6),
        Expanded(
          child: Text(text, style: TextStyle(color: color, fontSize: 12)),
        ),
      ],
    );
  }

  /// The requester's display name — never their id.
  String _requesterName(WidgetRef ref, AppLocalizations l10n) {
    final id = requesterId;
    if (id == null || id.isEmpty) return l10n.someone;
    final name = ref.watch(
        userProfileProvider(id).select((p) => p.valueOrNull?.displayName));
    return (name == null || name.trim().isEmpty) ? l10n.someone : name;
  }
}

/// Localized headline of an action, per `summary.kind`.
String aiActionTitle(AppLocalizations l10n, AiPendingAction action) {
  switch (action.kind) {
    case 'send_email':
      return l10n.aiActionSendEmail;
    case 'draft_email':
      return l10n.aiActionDraftEmail;
    case 'create_event':
      return l10n.aiActionCreateEvent;
    case 'update_event':
      return l10n.aiActionUpdateEvent;
    case 'create_page':
      return l10n.aiActionCreatePage;
    case 'update_page':
      return l10n.aiActionUpdatePage;
  }
  final tool = summaryText(action.summary['tool'], max: 60);
  return tool == null ? l10n.aiActionGeneric : l10n.aiActionGenericNamed(tool);
}

String _fieldLabel(AppLocalizations l10n, ActionSummaryField field) {
  switch (field) {
    case ActionSummaryField.to:
      return l10n.aiActionFieldTo;
    case ActionSummaryField.subject:
      return l10n.aiActionFieldSubject;
    case ActionSummaryField.title:
      return l10n.aiActionFieldTitle;
    case ActionSummaryField.when:
      return l10n.aiActionFieldWhen;
  }
}

/// Localized message for a failed confirm / cancel.
String aiActionErrorText(AppLocalizations l10n, AiActionError error) {
  switch (error) {
    case AiActionError.expired:
      return l10n.aiActionErrExpired;
    case AiActionError.notFound:
      return l10n.aiActionErrNotFound;
    case AiActionError.alreadyResolved:
      return l10n.aiActionErrAlreadyResolved;
    case AiActionError.notOwner:
      return l10n.aiActionErrNotOwner;
    case AiActionError.network:
      return l10n.errNetwork;
    case AiActionError.generic:
      return l10n.aiActionErrGeneric;
  }
}

final _dateOnly = RegExp(r'^\d{4}-\d{2}-\d{2}$');

/// An event's start (– end) for the locale. A date-only bound is a calendar
/// date (no time-zone shift); a value that does not parse is shown as given.
String formatActionWhen(String start, String? end, String locale) {
  String one(String v) {
    if (_dateOnly.hasMatch(v)) {
      final d = DateTime.tryParse(v);
      return d == null ? v : DateFormat.yMMMd(locale).format(d);
    }
    final t = DateTime.tryParse(v);
    return t == null
        ? v
        : DateFormat.yMMMd(locale).add_Hm().format(t.toLocal());
  }

  return end == null ? one(start) : '${one(start)} – ${one(end)}';
}
