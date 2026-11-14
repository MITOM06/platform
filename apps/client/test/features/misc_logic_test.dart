// Small pure-logic pieces across features: admin error messages, theme
// onboarding flag, pending-action merging, AI trace / source parsing, meeting
// event parsing and user profile visibility defaults.

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/providers/theme_provider.dart';
import 'package:platform_client/features/admin/data/models/admin_models.dart';
import 'package:platform_client/features/admin/ui/widgets/cap_label.dart';
import 'package:platform_client/features/admin/utils/admin_error.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/chat/domain/ai_models.dart';
import 'package:platform_client/features/chat/domain/ai_pending_action.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

DioException _dio(Object? body, {int status = 403}) {
  final o = RequestOptions(path: '/x');
  return DioException(
      requestOptions: o,
      type: DioExceptionType.badResponse,
      response: Response(requestOptions: o, statusCode: status, data: body));
}

void main() {
  final en = lookupAppLocalizations(const Locale('en'));

  group('admin errors', () {
    testWidgets('ROLE_GRANT_EXCEEDS lists the missing capabilities',
        (tester) async {
      late BuildContext ctx;
      await tester.pumpWidget(MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('en'),
        home: Builder(builder: (b) {
          ctx = b;
          return const SizedBox();
        }),
      ));
      final l = AppLocalizations.of(ctx);
      final top = adminErrorMessage(
          ctx,
          _dio({
            'code': 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS',
            'params': {
              'capabilities': [Cap.manageMembers, 'NOT_A_CAP', Cap.manageRoles]
            }
          }));
      expect(
          top,
          l.authErrRoleGrantExceedsOwnPermissions(
              '${capabilityLabelOf(l, Cap.manageMembers)}, '
              '${capabilityLabelOf(l, Cap.manageRoles)}'));
      expect(top, isNot(contains('NOT_A_CAP')));

      // Params nested under the legacy `message` object.
      final nested = adminErrorMessage(
          ctx,
          _dio({
            'message': {
              'code': 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS',
              'params': {
                'capabilities': [Cap.manageWorkspace]
              }
            }
          }));
      expect(nested,
          l.authErrRoleGrantExceedsOwnPermissions(
              capabilityLabelOf(l, Cap.manageWorkspace)));

      // No usable capabilities → generic sentence.
      expect(
          adminErrorMessage(
              ctx, _dio({'code': 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS'})),
          l.authErrRoleGrantExceedsOwnPermissionsGeneric);
      // Any other code goes through the shared auth mapping.
      expect(adminErrorMessage(ctx, _dio({'code': 'MEMBER_NOT_FOUND'})),
          l.authErrMemberNotFound);
    });

    test('Japanese joins capability names with 、', () {
      final ja = lookupAppLocalizations(const Locale('ja'));
      final s = roleGrantExceedsMessage(ja, {
        'capabilities': [Cap.manageMembers, Cap.manageRoles]
      });
      expect(s, contains('、'));
    });
  });

  test('theme onboarding flag reads and persists', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final c = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)]);
    addTearDown(c.dispose);
    expect(c.read(themeOnboardingNotifierProvider), isFalse);
    await c.read(themeOnboardingNotifierProvider.notifier).completeOnboarding();
    expect(c.read(themeOnboardingNotifierProvider), isTrue);
    expect(prefs.getBool('theme_onboarding_completed'), isTrue);
  });

  group('pending actions', () {
    test('status wire values', () {
      expect(aiActionStatusFrom(null), AiActionStatus.pending);
      expect(aiActionStatusFrom('pending'), AiActionStatus.pending);
      expect(aiActionStatusFrom('confirmed'), AiActionStatus.confirmed);
      expect(aiActionStatusFrom('cancelled'), AiActionStatus.cancelled);
      expect(aiActionStatusFrom('failed'), AiActionStatus.failed);
      expect(aiActionStatusFrom('expired'), AiActionStatus.expired);
      expect(aiActionStatusFrom('new_thing'), AiActionStatus.unknown);
    });

    test('tryParse copies the summary and falls back to the event requester',
        () {
      final a = AiPendingAction.tryParse({
        'id': 'a1',
        'summary': {'kind': 'send_email', 'to': 'x@y'},
        'expiresAt': '2026-01-01T00:00:00Z',
      }, requesterId: 'u9');
      expect(a?.summary, {'kind': 'send_email', 'to': 'x@y'});
      expect(a?.kind, 'send_email');
      expect(a?.requesterId, 'u9');
      expect(a?.expiresAt, DateTime.utc(2026));
      expect(AiPendingAction.tryParse({'id': 'a2'})?.kind, 'generic');
    });

    test('upsert appends new, resolves pending, never reopens', () {
      const p = AiPendingAction(id: 'a1');
      final added = upsertPendingAction(null, p);
      expect(added.single.id, 'a1');

      final resolved = upsertPendingAction(
          added, const AiPendingAction(id: 'a1', status: AiActionStatus.confirmed));
      expect(resolved.single.status, AiActionStatus.confirmed);

      final stays = upsertPendingAction(resolved, const AiPendingAction(id: 'a1'));
      expect(identical(stays, resolved), isTrue);

      final withReq = upsertPendingAction(
          added, const AiPendingAction(id: 'a1', requesterId: 'me'));
      expect(withReq.single.requesterId, 'me');
      expect(withReq.single.status, AiActionStatus.pending);
    });

    test('mergePendingActions / applyServerPendingActions', () {
      const known = [AiPendingAction(id: 'a1', requesterId: 'me')];
      expect(mergePendingActions(known, null), same(known));
      expect(mergePendingActions(known, const []), same(known));
      final merged = mergePendingActions(
          known, const [AiPendingAction(id: 'a2'), AiPendingAction(id: 'a1')]);
      expect(merged!.map((a) => a.id), ['a1', 'a2']);

      final server = applyServerPendingActions(known, const [
        AiPendingAction(id: 'a1', status: AiActionStatus.cancelled),
        AiPendingAction(id: 'a3', requesterId: 'bob'),
      ]);
      expect(server.map((a) => a.id), ['a1', 'a3']);
      expect(server[0].status, AiActionStatus.cancelled);
      expect(server[0].requesterId, 'me'); // kept from the client
      expect(server[1].requesterId, 'bob');
    });
  });

  group('AI trace / sources', () {
    test('AiTrace.fromJson parses tool calls with defaults', () {
      final t = AiTrace.fromJson(const {
        'thinkingBlocks': ['think'],
        'toolCalls': [
          {'toolName': 'web_search', 'inputSummary': 'q', 'resultSummary': 'r'},
          <String, dynamic>{},
        ],
        'inputTokens': 10,
        'outputTokens': 5.0,
        'model': 'm',
        'iterationCount': 2,
      });
      expect(t.thinkingBlocks, ['think']);
      expect(t.toolCalls.first.toolName, 'web_search');
      expect(t.toolCalls.first.inputSummary, 'q');
      expect(t.toolCalls.first.resultSummary, 'r');
      expect(t.toolCalls.last.toolName, '');
      expect(t.outputTokens, 5);
      expect(t.cachedInputTokens, 0);
      expect(t.processingMs, 0);
    });

    test('AiSource.tryParse accepts bare ids and maps', () {
      expect(AiSource.tryParse('doc1')?.documentId, 'doc1');
      expect(AiSource.tryParse('')?.documentId, isNull);
      expect(AiSource.tryParse(42), isNull);
      final web = AiSource.tryParse(
          {'documentId': 'w', 'url': 'https://x', 'type': 'web'});
      expect(web?.isWeb, isTrue);
      expect(AiSource.tryParse({'documentId': ''}), isNull);
    });
  });

  group('meeting events', () {
    test('lobby / denied / starting frames', () {
      final lobby = parseMeetingEvent({
        'event': 'meet.lobby',
        'meetingId': 'm1',
        'waiting': [
          {'userId': 'u1', 'displayName': 'A'},
          {'nope': 1},
        ],
      }) as LobbyEvent;
      expect(lobby.meetingId, 'm1');
      expect(lobby.waiting, const [LobbyEntry(userId: 'u1', displayName: 'A')]);

      expect(parseMeetingEvent({'event': 'meet.denied', 'meetingId': 'm1'}),
          isA<DeniedEvent>());

      final s = parseMeetingEvent(
              '{"event":"meet.starting","meetingId":"m2","code":"abc","title":"Sync","scheduledStart":"2026-05-01T09:00:00Z"}')
          as StartingEvent;
      expect(s.code, 'abc');
      expect(s.title, 'Sync');
      expect(s.scheduledStart, DateTime.utc(2026, 5, 1, 9));
      expect(parseMeetingEvent('{bad json'), isNull);
      expect(parseMeetingEvent({'event': 'meet.starting', 'meetingId': 'm2'}),
          isNull);
    });
  });

  test('UserModel visibility follows hideInfo unless set per field', () {
    final hidden = UserModel.fromJson(const {
      'id': 'u1',
      'hideInfo': true,
      'dateOfBirth': '2000-01-02',
      'showPhoneNumber': true,
    });
    expect(hidden.displayName, '');
    expect(hidden.dateOfBirth, DateTime(2000, 1, 2));
    expect(hidden.effectiveShowDateOfBirth, isFalse);
    expect(hidden.effectiveShowGender, isFalse);
    expect(hidden.effectiveShowPhoneNumber, isTrue);
    final open = UserModel.fromJson(const {'_id': 'u2', 'email': 'e@x.io'});
    expect(open.id, 'u2');
    expect(open.displayName, 'e@x.io');
    expect(open.effectiveShowDateOfBirth, isTrue);
    expect(en.localeName, 'en');
  });
}
