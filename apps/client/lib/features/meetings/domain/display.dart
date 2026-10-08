// Guards against rendering machine identifiers as names
// (.claude/rules/no-raw-system-data-in-ui.md) — mirror of web
// `lib/chat/names.ts` + `lib/meetings/display.ts`.

import 'meeting_models.dart';

final _objectId = RegExp(r'^[0-9a-f]{24}$', caseSensitive: false);

/// A Mongo ObjectId, a synthetic bot id, or the literal `system` sender.
bool looksLikeId(String value) {
  final v = value.trim();
  return _objectId.hasMatch(v) ||
      v == 'system' ||
      v.startsWith('extbot:') ||
      v.startsWith('ai-bot-');
}

/// Trimmed name, or null when absent / blank / looks like an id / equals
/// [userId] (the caller then shows a localized generic label).
String? safeDisplayName(String? name, [String? userId]) {
  final trimmed = name?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  if (userId != null && userId.isNotEmpty && trimmed == userId) return null;
  if (looksLikeId(trimmed)) return null;
  return trimmed;
}

/// A person's name for display — never their id ([fallback] is a localized
/// generic label).
String personName(MeetingPerson? p, String fallback) =>
    safeDisplayName(p?.displayName, p?.userId) ?? fallback;
