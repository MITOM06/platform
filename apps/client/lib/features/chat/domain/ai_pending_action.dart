import 'package:collection/collection.dart';
import 'package:flutter/foundation.dart';

/// Server status of a sensitive AI action held for confirmation
/// (CONTRACTS-ROUND2 §F2). `unknown` covers any value this client does not
/// know yet — it is rendered like an expired card, never as actionable.
enum AiActionStatus { pending, confirmed, cancelled, failed, expired, unknown }

AiActionStatus aiActionStatusFrom(Object? raw) {
  switch (raw) {
    case null:
    case 'pending':
      return AiActionStatus.pending;
    case 'confirmed':
      return AiActionStatus.confirmed;
    case 'cancelled':
      return AiActionStatus.cancelled;
    case 'failed':
      return AiActionStatus.failed;
    case 'expired':
      return AiActionStatus.expired;
    default:
      return AiActionStatus.unknown;
  }
}

/// One `pendingActions[]` item of an AI message — also the `action` of an
/// `AI_ACTION_PENDING` stream event.
///
/// [toolName] (`mcp__<provider>__<tool>`) and [provider] (a connector slug,
/// possibly `custom_<hex>`) are machine values: the UI maps [provider] to a
/// connector display name and renders [summary] through localized templates,
/// never either raw value.
@immutable
class AiPendingAction {
  final String id;
  final String toolName;
  final String provider;

  /// Humanized, non-secret description built by ai-service:
  /// `{kind: send_email|draft_email, to?, subject?}`,
  /// `{kind: create_event|update_event, title?, start?, end?}`,
  /// `{kind: create_page|update_page, title?}`, `{kind: generic, tool}`.
  final Map<String, dynamic> summary;
  final AiActionStatus status;
  final DateTime? expiresAt;

  /// The member who asked — the only one who may confirm or cancel.
  final String? requesterId;

  const AiPendingAction({
    required this.id,
    this.toolName = '',
    this.provider = '',
    this.summary = const {},
    this.status = AiActionStatus.pending,
    this.expiresAt,
    this.requesterId,
  });

  /// `summary.kind`, `generic` when absent.
  String get kind {
    final k = summary['kind'];
    return k is String && k.isNotEmpty ? k : 'generic';
  }

  /// Parses one item; null when it has no usable `id`. [requesterId] fills in
  /// the requester for stream payloads that carry it on the event, not on
  /// the action.
  static AiPendingAction? tryParse(Object? raw, {String? requesterId}) {
    if (raw is! Map) return null;
    final id = raw['id'];
    if (id is! String || id.isEmpty) return null;
    final summary = raw['summary'];
    final expires = raw['expiresAt'];
    final requester = raw['requesterId'];
    return AiPendingAction(
      id: id,
      toolName: raw['toolName'] is String ? raw['toolName'] as String : '',
      provider: raw['provider'] is String ? raw['provider'] as String : '',
      summary: summary is Map
          ? Map<String, dynamic>.from(summary)
          : const <String, dynamic>{},
      status: aiActionStatusFrom(raw['status']),
      expiresAt: expires is String ? DateTime.tryParse(expires) : null,
      requesterId: requester is String && requester.isNotEmpty
          ? requester
          : requesterId,
    );
  }

  AiPendingAction copyWith({AiActionStatus? status, String? requesterId}) =>
      AiPendingAction(
        id: id,
        toolName: toolName,
        provider: provider,
        summary: summary,
        status: status ?? this.status,
        expiresAt: expiresAt,
        requesterId: requesterId ?? this.requesterId,
      );
}

/// Parses a `pendingActions` array; null when [raw] is not a list (the field
/// is omitted when a message has no actions).
List<AiPendingAction>? parsePendingActions(Object? raw,
    {String? requesterId}) {
  if (raw is! List) return null;
  return raw
      .map((e) => AiPendingAction.tryParse(e, requesterId: requesterId))
      .whereType<AiPendingAction>()
      .toList();
}

/// Adds [action] (from `AI_ACTION_PENDING`) unless the message already knows
/// it — an already-known action keeps its (possibly newer) status and only
/// gains a missing requester.
List<AiPendingAction> upsertPendingAction(
  List<AiPendingAction>? current,
  AiPendingAction action,
) {
  final list = current ?? const <AiPendingAction>[];
  final existing = list.firstWhereOrNull((a) => a.id == action.id);
  if (existing == null) return [...list, action];
  if (existing.requesterId != null || action.requesterId == null) return list;
  return [
    for (final a in list)
      a.id == action.id ? a.copyWith(requesterId: action.requesterId) : a,
  ];
}

/// Merges the list of an `AI_STREAM_DONE` / persisted message into what the
/// bubble already shows: known actions keep their status, new ones are
/// appended, and a missing requester is filled in from either side.
List<AiPendingAction>? mergePendingActions(
  List<AiPendingAction>? current,
  List<AiPendingAction>? incoming,
) {
  if (incoming == null || incoming.isEmpty) return current;
  var out = current ?? const <AiPendingAction>[];
  for (final a in incoming) {
    out = upsertPendingAction(out, a);
  }
  return out;
}

/// Applies the authoritative list of a `MESSAGE_UPDATED` (status changes):
/// the server list wins, keeping a requester the client already knew when the
/// update omits it.
List<AiPendingAction> applyServerPendingActions(
  List<AiPendingAction>? current,
  List<AiPendingAction> server,
) {
  final known = {for (final a in current ?? const <AiPendingAction>[]) a.id: a};
  return [
    for (final a in server)
      a.requesterId == null && known[a.id]?.requesterId != null
          ? a.copyWith(requesterId: known[a.id]!.requesterId)
          : a,
  ];
}
