// AI summary of a meeting — mirror of web `lib/meetings/meeting-summary.ts`.
//
// [normalizeSummary] reads the `content` of a `meeting_summary` chat message and
// the `summary` object of `GET /api/meetings/{id}/summary`, in both shapes:
//  - old (group call): `actionItems: string[]`, no decisions / fromMaterials / title
//  - new (meeting):    `actionItems: {text, assigneeName|null}[]`, decisions,
//                      fromMaterials, title
//
// Rules (identical on web): non-object ⇒ null. Strings trimmed, blanks
// dropped (`overview` is kept raw, like web). Wrong-typed list elements dropped.
// Blank assignee / title ⇒ null.
// `durationSec` must be a finite number ≥ 0, else 0.

import 'json_read.dart';
import 'meeting_models.dart';

export 'meeting_models.dart' show MeetingSummaryState;

class SummaryActionItem {
  const SummaryActionItem({required this.text, this.assigneeName});

  final String text;
  final String? assigneeName;
}

class NormalizedSummary {
  const NormalizedSummary({
    this.overview = '',
    this.keyPoints = const [],
    this.decisions = const [],
    this.actionItems = const [],
    this.fromMaterials = const [],
    this.attendees = const [],
    this.durationSec = 0,
    this.title,
  });

  static const empty = NormalizedSummary();

  final String overview;
  final List<String> keyPoints;
  final List<String> decisions;
  final List<SummaryActionItem> actionItems;
  final List<String> fromMaterials;
  final List<String> attendees;
  final int durationSec;
  final String? title;

  bool get hasContent =>
      overview.isNotEmpty ||
      keyPoints.isNotEmpty ||
      decisions.isNotEmpty ||
      actionItems.isNotEmpty ||
      fromMaterials.isNotEmpty;
}

/// Trimmed non-empty string, else null.
String? _text(Object? v) {
  if (v is! String) return null;
  final s = v.trim();
  return s.isEmpty ? null : s;
}

List<String> _strings(Object? v) {
  if (v is! List) return const [];
  return List.unmodifiable(v.map(_text).whereType<String>());
}

List<SummaryActionItem> _actions(Object? v) {
  if (v is! List) return const [];
  final out = <SummaryActionItem>[];
  for (final item in v) {
    if (item is String) {
      final t = _text(item);
      if (t != null) out.add(SummaryActionItem(text: t));
    } else if (item is Map) {
      final t = _text(item['text']);
      if (t != null) {
        out.add(SummaryActionItem(
            text: t, assigneeName: _text(item['assigneeName'])));
      }
    }
  }
  return List.unmodifiable(out);
}

NormalizedSummary? normalizeSummary(Object? raw) {
  final o = asJson(raw);
  if (o == null) return null;
  final d = o['durationSec'];
  return NormalizedSummary(
    overview: o['overview'] is String ? o['overview'] as String : '',
    keyPoints: _strings(o['keyPoints']),
    decisions: _strings(o['decisions']),
    actionItems: _actions(o['actionItems']),
    fromMaterials: _strings(o['fromMaterials']),
    attendees: _strings(o['attendees']),
    durationSec: d is num && d.isFinite && d >= 0 ? d.toInt() : 0,
    title: _text(o['title']),
  );
}

/// `GET /api/meetings/{id}/summary`: the current [state] plus the newest
/// successful summary (it may be older than [state] says: PENDING / FAILED
/// after a regenerate).
class MeetingSummaryResponse {
  const MeetingSummaryResponse({
    this.state,
    this.summary,
    this.groupConversationId,
    required this.inGroup,
  });

  /// null = never asked.
  final MeetingSummaryState? state;
  final NormalizedSummary? summary;
  final String? groupConversationId;
  final bool inGroup;

  /// null when the body is not an object.
  static MeetingSummaryResponse? fromJson(Object? v) {
    final o = asJson(v);
    if (o == null) return null;
    return MeetingSummaryResponse(
      state: MeetingSummaryState.fromWire(o['state']),
      summary: normalizeSummary(o['summary']),
      groupConversationId: str(o['groupConversationId']),
      inGroup: o['inGroup'] == true,
    );
  }

  MeetingSummaryResponse withState(MeetingSummaryState s) =>
      MeetingSummaryResponse(
        state: s,
        summary: summary,
        groupConversationId: groupConversationId,
        inGroup: inGroup,
      );
}
