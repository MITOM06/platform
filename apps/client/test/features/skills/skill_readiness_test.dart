import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/integrations/data/models/connector_models.dart';
import 'package:platform_client/features/skills/data/skill_defs.dart';
import 'package:platform_client/features/skills/domain/skill_readiness.dart';

ConnectionView _conn(String provider, ConnectionStatus status) => ConnectionView(
      id: provider,
      provider: provider,
      status: status,
      scopes: const [],
      accountLabel: null,
      lastUsedAt: null,
      actionGroups: const ['view'],
    );

void main() {
  final scheduler = kSkillDefs.firstWhere((s) => s.id == 'scheduler');

  test('a skill is ready once every required connector is connected', () {
    final connections = [
      _conn('calendar', ConnectionStatus.active),
      _conn('gmail', ConnectionStatus.active),
    ];
    expect(missingConnectors(scheduler.requires, connections), isEmpty);
  });

  test('lists what is still missing; an expired connection does not count', () {
    final connections = [
      _conn('calendar', ConnectionStatus.active),
      _conn('gmail', ConnectionStatus.expired),
    ];
    expect(missingConnectors(scheduler.requires, connections), ['gmail']);
    expect(missingConnectors(scheduler.requires, const []), ['calendar', 'gmail']);
  });

  test('a skill without required connectors is always ready', () {
    expect(missingConnectors(const [], const []), isEmpty);
  });
}
