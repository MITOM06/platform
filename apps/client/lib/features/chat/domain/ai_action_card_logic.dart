import 'package:dio/dio.dart';

import 'ai_pending_action.dart';
import 'conversations_realtime_handlers.dart' show looksLikeRawId;

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

/// One "label: value" row under the card headline. [custom] rows carry the
/// server's own humanized label (generic actions). There is deliberately no
/// body row: the card is visible to the whole group, so an email's body is
/// never shown (the server never sends it either).
enum ActionSummaryField {
  to,
  cc,
  bcc,
  subject,
  title,
  when,
  attendees,
  custom,
}

/// Most rows a generic action's `fields` adds to the card.
const kMaxGenericActionFields = 6;

class ActionSummaryLine {
  final ActionSummaryField field;
  final String value;

  /// For [ActionSummaryField.when]: the raw `start` / `end` values (ISO or
  /// `YYYY-MM-DD`) — the widget formats them for the locale.
  final String? end;

  /// For [ActionSummaryField.custom]: the server-humanized parameter name
  /// ("Title"), shown as is.
  final String? label;

  const ActionSummaryLine(this.field, this.value, {this.end, this.label});
}

/// The detail rows of an action's `summary` (never the raw tool name, never
/// a raw id). Strings are collapsed to one line and capped. Fields an older
/// ai-service does not send are simply absent.
List<ActionSummaryLine> actionSummaryLines(AiPendingAction action) {
  final s = action.summary;
  final lines = <ActionSummaryLine>[];
  void push(ActionSummaryField field, Object? value, {int max = 200}) {
    final v = summaryText(value, max: max);
    if (v != null) lines.add(ActionSummaryLine(field, v));
  }

  switch (action.kind) {
    case 'send_email':
    case 'draft_email':
      push(ActionSummaryField.to, s['to']);
      push(ActionSummaryField.cc, s['cc']);
      push(ActionSummaryField.bcc, s['bcc']);
      push(ActionSummaryField.subject, s['subject']);
    // Never the body (`body` / `bodyPreview`), even if one were sent.
    case 'create_event':
    case 'update_event':
      push(ActionSummaryField.title, s['title']);
      final start = summaryText(s['start'], max: 64);
      if (start != null) {
        lines.add(ActionSummaryLine(ActionSummaryField.when, start,
            end: summaryText(s['end'], max: 64)));
      }
      push(ActionSummaryField.attendees, s['attendees']);
    case 'create_page':
    case 'update_page':
      push(ActionSummaryField.title, s['title']);
    default: // generic: `fields: [{label, value}]`
      lines.addAll(_genericFields(s['fields']).take(kMaxGenericActionFields));
  }
  return lines;
}

/// "label: value" rows of a generic action: `label` is humanized by the
/// server ("Channel", "Due date") and shown as is; `value` is a string (a
/// list arrives joined with ", "), at most 120 characters. Malformed rows —
/// not a map, a non-string or empty label / value — and values that are a
/// raw id are left out.
Iterable<ActionSummaryLine> _genericFields(Object? raw) sync* {
  if (raw is! List) return;
  for (final f in raw) {
    if (f is! Map) continue;
    final label = summaryText(f['label'], max: 60);
    final value = summaryText(f['value'], max: 120);
    if (label == null || value == null || looksLikeRawId(value)) continue;
    yield ActionSummaryLine(ActionSummaryField.custom, value, label: label);
  }
}

/// A single-line, length-capped summary string; null when empty.
String? summaryText(Object? value, {int max = 200}) {
  if (value is! String) return null;
  final v = value.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (v.isEmpty) return null;
  return v.length > max ? '${v.substring(0, max - 1)}…' : v;
}
