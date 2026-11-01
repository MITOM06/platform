import '../../integrations/data/models/connector_models.dart';

/// The connectors a skill requires that are not connected (active) yet — empty
/// means the skill is ready. A connection counts whatever its scope. Mirrors web
/// `missingConnectors` (`apps/web/lib/skills.ts`).
List<String> missingConnectors(
  List<String> requires,
  Iterable<ConnectionView> connections,
) {
  final active = {
    for (final c in connections)
      if (c.status == ConnectionStatus.active) c.provider,
  };
  return requires.where((id) => !active.contains(id)).toList();
}
