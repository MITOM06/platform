import 'package:dio/dio.dart';

import 'ai_pending_action.dart';

/// What a confirmation card shows for one pending action. Pure logic shared by
/// the card widget and the tests — mirror of web `lib/ai/pending-actions.ts`.
enum ActionCardKind {
  /// Confirm / Cancel buttons (the requester, still pending, not expired).
  actionable,

  /// Still pending, but another member must decide.
  waiting,
  confirmed,
  cancelled,
  failed,
  expired,

  /// Resolved elsewhere (another device) and the outcome has not arrived yet.
  handled,
}

/// Card state. A server status other than `pending` always wins (it is the
/// truth broadcast by `MESSAGE_UPDATED`); while the server still says
/// `pending`, this client's own [local] outcome (a confirm/cancel it just got
/// an answer for) is shown instead.
ActionCardKind actionCardKind(
  AiPendingAction action, {
  required String? me,
  required DateTime now,
  ActionCardKind? local,
}) {
  switch (action.status) {
    case AiActionStatus.confirmed:
      return ActionCardKind.confirmed;
    case AiActionStatus.cancelled:
      return ActionCardKind.cancelled;
    case AiActionStatus.failed:
      return ActionCardKind.failed;
    case AiActionStatus.expired:
    case AiActionStatus.unknown:
      return ActionCardKind.expired;
    case AiActionStatus.pending:
      break;
  }
  if (local != null &&
      local != ActionCardKind.actionable &&
      local != ActionCardKind.waiting) {
    return local;
  }
  final expires = action.expiresAt;
  if (expires != null && !now.isBefore(expires)) return ActionCardKind.expired;
  if (me != null && action.requesterId == me) return ActionCardKind.actionable;
  return ActionCardKind.waiting;
}

/// Outcome of a successful `POST /ai/actions/:id/{confirm,cancel}` body
/// (`{status}`); null for anything unexpected.
ActionCardKind? actionOutcomeFromResponse(Object? body) {
  final status = body is Map ? body['status'] : null;
  switch (status) {
    case 'confirmed':
      return ActionCardKind.confirmed;
    case 'cancelled':
      return ActionCardKind.cancelled;
    case 'failed':
      return ActionCardKind.failed;
    default:
      return null;
  }
}

/// Why a confirm / cancel failed — each maps to its own localized message.
enum AiActionError { expired, notFound, alreadyResolved, notOwner, network, generic }

class AiActionErrorOutcome {
  final AiActionError error;

  /// What the card shows next (null = keep the buttons so the user can retry).
  final ActionCardKind? outcome;

  const AiActionErrorOutcome(this.error, this.outcome);
}

/// Maps a failed confirm/cancel (`{statusCode, code, message}` from
/// ai-service) to a typed error + the card's next state.
AiActionErrorOutcome aiActionErrorOutcome(Object error) {
  if (error is! DioException) {
    return const AiActionErrorOutcome(AiActionError.generic, null);
  }
  final response = error.response;
  if (response == null) {
    return const AiActionErrorOutcome(AiActionError.network, null);
  }
  final data = response.data;
  final code = data is Map ? data['code'] : null;
  final status = response.statusCode;
  if (code == 'ACTION_EXPIRED' || status == 410) {
    return const AiActionErrorOutcome(
        AiActionError.expired, ActionCardKind.expired);
  }
  if (code == 'ACTION_NOT_FOUND' || status == 404) {
    return const AiActionErrorOutcome(
        AiActionError.notFound, ActionCardKind.expired);
  }
  if (code == 'ACTION_ALREADY_RESOLVED' || status == 409) {
    return const AiActionErrorOutcome(
        AiActionError.alreadyResolved, ActionCardKind.handled);
  }
  if (code == 'ACTION_NOT_OWNER' || status == 403) {
    return const AiActionErrorOutcome(AiActionError.notOwner, null);
  }
  return const AiActionErrorOutcome(AiActionError.generic, null);
}

/// One "label: value" row under the card headline.
enum ActionSummaryField { to, subject, title, when }

class ActionSummaryLine {
  final ActionSummaryField field;
  final String value;

  /// For [ActionSummaryField.when]: the raw `start` / `end` values (ISO or
  /// `YYYY-MM-DD`) — the widget formats them for the locale.
  final String? end;

  const ActionSummaryLine(this.field, this.value, {this.end});
}

/// The detail rows of an action's `summary` (never the raw tool name).
/// Strings are collapsed to one line and capped.
List<ActionSummaryLine> actionSummaryLines(AiPendingAction action) {
  final s = action.summary;
  final lines = <ActionSummaryLine>[];
  void push(ActionSummaryField field, Object? value) {
    final v = summaryText(value);
    if (v != null) lines.add(ActionSummaryLine(field, v));
  }

  switch (action.kind) {
    case 'send_email':
    case 'draft_email':
      push(ActionSummaryField.to, s['to']);
      push(ActionSummaryField.subject, s['subject']);
    case 'create_event':
    case 'update_event':
      push(ActionSummaryField.title, s['title']);
      final start = summaryText(s['start'], max: 64);
      if (start != null) {
        lines.add(ActionSummaryLine(ActionSummaryField.when, start,
            end: summaryText(s['end'], max: 64)));
      }
    case 'create_page':
    case 'update_page':
      push(ActionSummaryField.title, s['title']);
  }
  return lines;
}

/// A single-line, length-capped summary string; null when empty.
String? summaryText(Object? value, {int max = 200}) {
  if (value is! String) return null;
  final v = value.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (v.isEmpty) return null;
  return v.length > max ? '${v.substring(0, max - 1)}…' : v;
}
