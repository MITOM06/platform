import 'package:flutter/foundation.dart';

/// Static skill definition. Mirrors web `lib/skills.ts`. The user-facing name
/// and description are localized in the UI via [nameKey] / [descKey]; the
/// [requires] list names the connector providers a skill depends on.
@immutable
class SkillDef {
  final String id;
  final String icon;

  /// Connector provider ids this skill needs (e.g. 'notion', 'gmail').
  final List<String> requires;

  /// Extra non-connector requirements (e.g. 'web') shown as plain labels.
  final List<String> extras;

  const SkillDef({
    required this.id,
    required this.icon,
    this.requires = const [],
    this.extras = const [],
  });
}

/// The catalog of skills, matching the web `lib/skills.ts` and the mockup
/// (Scheduler, Mail writer, Researcher, Project keeper).
const List<SkillDef> kSkillDefs = [
  SkillDef(
    id: 'scheduler',
    icon: '🗓️',
    requires: ['google-calendar', 'gmail'],
  ),
  SkillDef(
    id: 'mailWriter',
    icon: '✍️',
    requires: ['gmail'],
  ),
  SkillDef(
    id: 'researcher',
    icon: '📚',
    requires: ['google-drive'],
    extras: ['web'],
  ),
  SkillDef(
    id: 'projectKeeper',
    icon: '🧩',
    requires: ['notion'],
  ),
  SkillDef(
    id: 'meetingNotes',
    icon: '🎙️',
  ),
  SkillDef(
    id: 'inboxTriage',
    icon: '📥',
    requires: ['gmail'],
  ),
  SkillDef(
    id: 'dataAnalyst',
    icon: '📊',
  ),
  SkillDef(
    id: 'docDrafter',
    icon: '📝',
  ),
  SkillDef(
    id: 'translator',
    icon: '🌐',
  ),
];
