// SkillsNotifier: requires a signed-in user, maps GET /skills to a toggle map
// and flips optimistically with a revert when PUT fails.

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/domain/session_reset.dart';
import 'package:platform_client/features/integrations/data/connector_repository.dart';
import 'package:platform_client/features/integrations/data/models/connector_models.dart';
import 'package:platform_client/features/skills/state/skills_provider.dart';

class _Repo extends Mock implements ConnectorRepository {}

class _Auth extends AuthNotifier {
  _Auth(this.s);
  final AuthState s;
  @override
  Future<AuthState> build() async => s;
}

const _user = UserModel(id: 'u1', email: 'a@x.io', displayName: 'A');

void main() {
  late _Repo repo;

  ProviderContainer make(AuthState auth) {
    final c = ProviderContainer(overrides: [
      connectorRepositoryProvider.overrideWithValue(repo),
      authNotifierProvider.overrideWith(() => _Auth(auth)),
    ]);
    addTearDown(c.dispose);
    return c;
  }

  setUp(() => repo = _Repo());

  test('loads persisted toggles as a map', () async {
    when(() => repo.getSkills()).thenAnswer((_) async => const [
          UserSkillState(skillId: 'summarize', enabled: true),
          UserSkillState(skillId: 'translate', enabled: false),
        ]);
    final c = make(const AuthAuthenticated(_user));
    await c.read(authNotifierProvider.future);
    expect(await c.read(skillsProvider.future),
        {'summarize': true, 'translate': false});
  });

  test('signed out → StateError, repository never called', () async {
    final c = make(const AuthUnauthenticated());
    await c.read(authNotifierProvider.future);
    await expectLater(c.read(skillsProvider.future), throwsStateError);
    verifyNever(() => repo.getSkills());
  });

  test('setSkill is optimistic and persists', () async {
    when(() => repo.getSkills()).thenAnswer((_) async => const []);
    final gate = Completer<void>();
    when(() => repo.setSkill(skillId: 'summarize', enabled: true))
        .thenAnswer((_) => gate.future);
    final c = make(const AuthAuthenticated(_user));
    await c.read(authNotifierProvider.future);
    await c.read(skillsProvider.future);
    final pending = c.read(skillsProvider.notifier).setSkill('summarize', true);
    expect(c.read(skillsProvider).value, {'summarize': true});
    gate.complete();
    await pending;
    verify(() => repo.setSkill(skillId: 'summarize', enabled: true)).called(1);
  });

  test('setSkill failure reverts to the previous value and rethrows', () async {
    when(() => repo.getSkills()).thenAnswer((_) async =>
        const [UserSkillState(skillId: 'summarize', enabled: true)]);
    when(() => repo.setSkill(skillId: 'summarize', enabled: false)).thenThrow(
        DioException(
            requestOptions: RequestOptions(path: '/skills'),
            type: DioExceptionType.connectionError));
    final c = make(const AuthAuthenticated(_user));
    await c.read(authNotifierProvider.future);
    await c.read(skillsProvider.future);
    await expectLater(
        c.read(skillsProvider.notifier).setSkill('summarize', false),
        throwsA(isA<DioException>()));
    expect(c.read(skillsProvider).value, {'summarize': true});
  });

  test('refresh reloads and surfaces errors as AsyncError', () async {
    var n = 0;
    when(() => repo.getSkills()).thenAnswer((_) async {
      n++;
      if (n == 2) throw StateError('down');
      return [UserSkillState(skillId: 's$n', enabled: true)];
    });
    final c = make(const AuthAuthenticated(_user));
    await c.read(authNotifierProvider.future);
    expect(await c.read(skillsProvider.future), {'s1': true});
    await c.read(skillsProvider.notifier).refresh();
    expect(c.read(skillsProvider).hasError, isTrue);
    await c.read(skillsProvider.notifier).refresh();
    expect(c.read(skillsProvider).value, {'s3': true});
  });

  test('CLAIMS_CHANGED invalidation reloads the skill toggles', () async {
    var n = 0;
    when(() => repo.getSkills()).thenAnswer((_) async {
      n++;
      return [UserSkillState(skillId: 'v$n', enabled: true)];
    });
    final c = make(const AuthAuthenticated(_user));
    await c.read(authNotifierProvider.future);
    final sub = c.listen(skillsProvider, (_, __) {});
    addTearDown(sub.close);
    expect(await c.read(skillsProvider.future), {'v1': true});
    final trigger = Provider<void Function()>(
        (ref) => () => invalidateClaimsDependentState(ref));
    c.read(trigger)();
    expect(await c.read(skillsProvider.future), {'v2': true});
    expect(n, 2);
  });
}
