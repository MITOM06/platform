import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/admin/data/admin_repository.dart';
import 'package:platform_client/features/admin/data/models/admin_models.dart';
import 'package:platform_client/features/admin/data/models/usage_dashboard_models.dart';
import 'package:platform_client/features/admin/state/admin_providers.dart';
import 'package:platform_client/features/admin/state/capabilities_provider.dart';

import '../integrations/route_adapter.dart';

ProviderContainer _container(RouteAdapter a) {
  final c = ProviderContainer(overrides: [
    adminRepositoryProvider.overrideWithValue(AdminRepository(dioWith(a))),
  ]);
  addTearDown(c.dispose);
  return c;
}

Map<String, dynamic> _member(String id,
        {String status = 'active', bool mfa = false}) =>
    {
      '_id': id,
      'displayName': 'M $id',
      'email': '$id@acme.com',
      'status': status,
      'mfaEnabled': mfa,
    };

void main() {
  group('admin models parse sparse / null payloads without crashing', () {
    test('MeCapabilities: empty body → Member with no perms, no admin', () {
      final caps = MeCapabilities.fromJson(const {});
      expect(caps.role, 'Member');
      expect(caps.perms, isEmpty);
      expect(caps.workspace.name, '');
      expect(caps.workspace.assistantName, isNull);
      expect(caps.canAccessAdmin, isFalse);
      expect(caps.has(Cap.manageMembers), isFalse);
    });

    test('canAccessAdmin only for admin-section capabilities', () {
      MeCapabilities with_(List<String> perms) =>
          MeCapabilities.fromJson({'perms': perms});
      expect(with_([Cap.usePersonalAssistant, Cap.hostMeeting]).canAccessAdmin,
          isFalse);
      for (final cap in Cap.adminSections) {
        expect(with_([cap]).canAccessAdmin, isTrue, reason: cap);
      }
      expect(Cap.all.toSet(), containsAll(Cap.adminSections));
    });

    test('workspace: features coerce to strict bools, unknown values off', () {
      final ws = Workspace.fromJson({
        'id': 'w1',
        'features': {'ai': true, 'meet': 'yes', 'x': null},
        'connectorAllowList': ['gmail', 3],
        'sso': null,
        'aiSettings': null,
      });
      expect(ws.id, 'w1');
      expect(ws.features, {'ai': true, 'meet': false, 'x': false});
      expect(ws.connectorAllowList, ['gmail', '3']);
      expect(ws.sso.enabled, isFalse);
      expect(ws.sso.enforced, isFalse);
      expect(ws.aiSettings.allowedConnectors, isNull);
      expect(Workspace.fromJson(const {}).id, '');
    });

    test('WorkspaceSso: round trip; empty default role omitted; enforced strict',
        () {
      final sso = WorkspaceSso.fromJson({
        'enabled': true,
        'enforced': 'true',
        'allowedDomains': ['acme.com'],
        'groupRoleMap': {'eng': 'r1', 'ops': null},
        'defaultRole': '',
      });
      expect(sso.enforced, isFalse);
      expect(sso.groupRoleMap, {'eng': 'r1', 'ops': ''});
      expect(sso.toJson(), {
        'enabled': true,
        'enforced': false,
        'allowedDomains': ['acme.com'],
        'groupRoleMap': {'eng': 'r1', 'ops': ''},
        'groupDeptMap': <String, String>{},
      });
      expect(
          const WorkspaceSso(defaultRole: 'r2').toJson()['defaultRole'], 'r2');
    });

    test('AI settings: absent allowedConnectors = inherit, [] = allow none', () {
      expect(WorkspaceAiSettings.fromJson(const {}).allowedConnectors, isNull);
      expect(
          WorkspaceAiSettings.fromJson(const {'allowedConnectors': null})
              .allowedConnectors,
          isNull);
      expect(
          WorkspaceAiSettings.fromJson(const {'allowedConnectors': []})
              .allowedConnectors,
          isEmpty);
      final s = WorkspaceAiSettings.fromJson(const {
        'monthlyTokenLimit': 1.5e6,
        'dailyDigestHour': 8.0,
        'dailyDigestEnabled': true,
        'modelTier': 'mid',
      });
      expect(s.monthlyTokenLimit, 1500000);
      expect(s.dailyDigestHour, 8);
      expect(s.dailyDigestEnabled, isTrue);
      expect(s.webSearchEnabled, isNull);
    });

    test('department / member / role / audit fallbacks', () {
      final d = Department.fromJson(const {'id': 'd1', 'leadUserId': 42});
      expect(d.name, '');
      expect(d.leadUserId, '42');

      final m = Member.fromJson(const {'id': 'm1'});
      expect(m.status, 'active');
      expect(m.isBlocked, isFalse);
      expect(m.mfaEnabled, isFalse);
      expect(m.departmentIds, isEmpty);
      final reset = Member.fromJson(_member('m2', status: 'blocked', mfa: true))
          .withMfaReset();
      expect(reset.mfaEnabled, isFalse);
      expect(reset.isBlocked, isTrue);
      expect(reset.email, 'm2@acme.com');

      final r = Role.fromJson(const {
        '_id': 'r1',
        'name': 'Owner',
        'permissions': {'MANAGE_ROLES': true, 'X': 1}
      });
      expect(r.isOwner, isTrue);
      expect(r.isPreset, isFalse);
      expect(r.permissions, {'MANAGE_ROLES': true, 'X': false});
      expect(Role.fromJson(const {'id': 'r2', 'name': 'owner'}).isOwner, isFalse);

      final audit = AuditListResult.fromJson({
        'items': [
          <String, dynamic>{'createdAt': 'garbage', 'targetId': 7},
          <String, dynamic>{},
        ]
      });
      expect(audit.total, 0);
      expect(audit.page, 0);
      expect(audit.limit, 20);
      expect(audit.items.first.createdAt, isNull);
      expect(audit.items.first.targetId, '7');
      expect(audit.items.last.id, '');
      expect(audit.items.last.targetName, isNull);
    });
  });

  group('usage dashboard models', () {
    test('empty payload → zeros and empty lists', () {
      final d = UsageDashboard.fromJson(const {});
      expect(d.range.label, isNull);
      expect(d.totals.totalTokens, 0);
      expect(d.totals.estimatedCostUsd, 0.0);
      expect(d.perModelCost, isEmpty);
      expect(d.topUsers, isEmpty);
      expect(d.feedback.total, 0);
      expect(d.feedback.worstAnswers, isEmpty);
      expect(UsageTotals.empty.requestCount, 0);
      expect(UsageFeedback.empty.thumbsDownRate, 0);
    });

    test('nulls inside rows and non-string fields fall back safely', () {
      final d = UsageDashboard.fromJson({
        'range': {'from': '2026-11-01', 'to': 5, 'label': null},
        'totals': {'inputTokens': 10.9, 'totalTokens': null, 'estimatedCostUsd': 1},
        'perModelCost': [
          {'model': null, 'costUsd': 0.25}
        ],
        'topUsers': [
          {'userId': null, 'displayName': 3}
        ],
        'feedback': {
          'up': 3,
          'down': 1,
          'thumbsDownRate': 0.25,
          'worstAnswers': [
            {'messageId': null, 'comment': 'bad'}
          ],
        },
      });
      expect(d.range.from, '2026-11-01');
      expect(d.range.to, isNull);
      expect(d.totals.inputTokens, 10);
      expect(d.totals.totalTokens, 0);
      expect(d.totals.estimatedCostUsd, 1.0);
      expect(d.perModelCost.single.model, '—');
      expect(d.perModelCost.single.costUsd, 0.25);
      expect(d.topUsers.single.userId, '');
      expect(d.topUsers.single.displayName, isNull);
      expect(d.feedback.thumbsDownRate, 0.25);
      expect(d.feedback.worstAnswers.single.messageId, '');
      expect(d.feedback.worstAnswers.single.comment, 'bad');
    });

    test('TopUser.safeName never returns an id', () {
      TopUser u(String id, String? name) => TopUser.fromJson(
          {'userId': id, 'displayName': name, 'totalTokens': 1});
      expect(u('u1', 'Mia').safeName, 'Mia');
      expect(u('u1', '  Mia  ').safeName, 'Mia');
      expect(u('u1', null).safeName, isNull);
      expect(u('u1', '   ').safeName, isNull);
      expect(u('u1', 'u1').safeName, isNull);
      expect(u('x', '6e3f00aa11bb22cc33dd44ee').safeName, isNull);
      expect(u('x', '6E3F00AA11BB22CC33DD44EE').safeName, isNull);
      // 23 hex chars is a name, not an ObjectId.
      expect(u('x', '6e3f00aa11bb22cc33dd44e').safeName,
          '6e3f00aa11bb22cc33dd44e');
    });
  });

  group('AdminRepository', () {
    test('routes, query params and payloads', () async {
      final a = RouteAdapter({
        'GET /me/capabilities': const Reply(200, {
          'role': 'Admin',
          'perms': ['MANAGE_MEMBERS'],
        }),
        'GET /admin/workspace': const Reply(200, {'_id': 'w', 'name': 'Acme'}),
        'PATCH /admin/workspace': (RecordedRequest r) =>
            Reply(200, {'_id': 'w', 'name': (r.data as Map)['name']}),
        'GET /admin/departments': const Reply(200, [
          {'_id': 'd1', 'name': 'Eng'}
        ]),
        'POST /admin/departments': const Reply(201, {}),
        'PATCH /admin/departments/d1': const Reply(200, {}),
        'DELETE /admin/departments/d1': const Reply(200, {}),
        'PATCH /admin/members/m1': const Reply(200, {}),
        'POST /admin/members/m1/mfa/reset': const Reply(200, {}),
        'GET /admin/invitations': const Reply(200, []),
        'POST /admin/invitations': const Reply(201, {'emailSent': false}),
        'POST /admin/invitations/i1/resend': const Reply(200, {'emailSent': true}),
        'DELETE /admin/invitations/i1': const Reply(200, {}),
        'POST /admin/roles': const Reply(201, {}),
        'PATCH /admin/roles/r1': const Reply(200, {}),
        'GET /admin/audit': const Reply(200, {'items': [], 'total': 0}),
      });
      final repo = AdminRepository(dioWith(a));
      expect((await repo.capabilities()).canAccessAdmin, isTrue);
      expect((await repo.getWorkspace()).name, 'Acme');
      expect((await repo.updateWorkspace({'name': 'New'})).name, 'New');
      expect((await repo.listDepartments()).single.name, 'Eng');
      await repo.createDepartment({'name': 'Ops'});
      await repo.updateDepartment('d1', {'name': 'E'});
      await repo.deleteDepartment('d1');
      await repo.updateMember('m1', {'roleId': 'r1'});
      await repo.resetMemberMfa('m1');

      await repo.listInvitations();
      expect(a.requests.last.query, isEmpty);
      await repo.listInvitations(status: 'accepted');
      expect(a.requests.last.query, {'status': 'accepted'});

      await repo.createInvitation(email: 'n@acme.com');
      expect(a.requests.last.data, {'email': 'n@acme.com'});
      await repo.createInvitation(
          email: 'n@acme.com', roleId: 'r1', departmentIds: ['d1'], locale: 'vi');
      expect(a.requests.last.data, {
        'email': 'n@acme.com',
        'roleId': 'r1',
        'departmentIds': ['d1'],
        'locale': 'vi',
      });
      await repo.resendInvitation('i1');
      await repo.revokeInvitation('i1');
      await repo.createRole({'name': 'QA'});
      await repo.updateRole('r1', {'name': 'QA2'});
      await repo.listAudit(page: 2);
      expect(a.requests.last.query, {'page': 2, 'limit': 20});
    });
  });

  group('admin providers', () {
    test('workspace save updates state and invalidates capabilities', () async {
      var capsCalls = 0;
      final a = RouteAdapter({
        'GET /admin/workspace': const Reply(200, {'_id': 'w', 'name': 'Old'}),
        'PATCH /admin/workspace': const Reply(200, {'_id': 'w', 'name': 'New'}),
        'GET /me/capabilities': (RecordedRequest _) {
          capsCalls++;
          return const Reply(200, {'perms': []});
        },
      });
      final c = _container(a);
      c.listen(capabilitiesProvider, (_, __) {});
      await c.read(capabilitiesProvider.future);
      await c.read(workspaceProvider.future);
      await c.read(workspaceProvider.notifier).save({'name': 'New'});
      expect(c.read(workspaceProvider).value!.name, 'New');
      await c.read(capabilitiesProvider.future);
      expect(capsCalls, 2);
    });

    test('capabilities: refreshSilently keeps the last value on failure', () async {
      var fail = false;
      final a = RouteAdapter({
        'GET /me/capabilities': (RecordedRequest _) => fail
            ? const Reply(503, {})
            : const Reply(200, {
                'perms': ['VIEW_AUDIT_LOG']
              }),
      });
      final c = _container(a);
      await c.read(capabilitiesProvider.future);
      expect(c.read(canAccessAdminProvider), isTrue);
      expect(c.read(hasCapabilityProvider(Cap.viewAuditLog)), isTrue);
      expect(c.read(hasCapabilityProvider(Cap.manageRoles)), isFalse);

      fail = true;
      await c.read(capabilitiesProvider.notifier).refreshSilently();
      expect(c.read(capabilitiesProvider).value!.perms, ['VIEW_AUDIT_LOG']);

      // A visible refresh surfaces the error; the last known claims stay
      // (Riverpod keeps the previous value) — the server still enforces.
      await c.read(capabilitiesProvider.notifier).refresh();
      expect(c.read(capabilitiesProvider).hasError, isTrue);
      expect(c.read(canAccessAdminProvider), isTrue);
    });

    test('members: block patches the row in place; mfa reset clears the flag',
        () async {
      var listCalls = 0;
      final a = RouteAdapter({
        'GET /admin/members': (RecordedRequest _) {
          listCalls++;
          return Reply(200, [_member('m1', mfa: true), _member('m2')]);
        },
        'PATCH /admin/members/m1/status': (RecordedRequest r) => Reply(
            200, _member('m1', status: (r.data as Map)['status'] as String)),
        'POST /admin/members/m1/mfa/reset': const Reply(200, {}),
        'PATCH /admin/members/m2': const Reply(200, {}),
      });
      final c = _container(a);
      await c.read(membersProvider.future);
      await c.read(membersProvider.notifier).setStatus('m1', 'blocked');
      final rows = c.read(membersProvider).value!;
      expect(rows.first.isBlocked, isTrue);
      expect(rows.last.isBlocked, isFalse);
      expect(listCalls, 1);
      expect(a.calls('PATCH', '/admin/members/m1/status').single.data,
          {'status': 'blocked'});

      await c.read(membersProvider.notifier).resetMfa('m1');
      // setStatus answered mfaEnabled false already; reload to check reset alone.
      expect(c.read(membersProvider).value!.first.mfaEnabled, isFalse);

      await c.read(membersProvider.notifier).updateMember('m2', {'roleId': 'r'});
      expect(listCalls, 2);
    });

    test('members: a forbidden block propagates and the list is unchanged',
        () async {
      final a = RouteAdapter({
        'GET /admin/members': Reply(200, [_member('m1')]),
        'PATCH /admin/members/m1/status':
            const Reply(403, {'code': 'OWNER_PROTECTED'}),
        'POST /admin/members/m1/mfa/reset':
            const Reply(403, {'code': 'MFA_RESET_FORBIDDEN'}),
      });
      final c = _container(a);
      await c.read(membersProvider.future);
      await expectLater(
          c.read(membersProvider.notifier).setStatus('m1', 'blocked'),
          throwsA(isA<DioException>()));
      await expectLater(c.read(membersProvider.notifier).resetMfa('m1'),
          throwsA(isA<DioException>()));
      expect(c.read(membersProvider).value!.single.isBlocked, isFalse);
    });

    test('members: mfa reset only touches the target row', () async {
      final a = RouteAdapter({
        'GET /admin/members':
            Reply(200, [_member('m1', mfa: true), _member('m2', mfa: true)]),
        'POST /admin/members/m1/mfa/reset': const Reply(200, {}),
      });
      final c = _container(a);
      await c.read(membersProvider.future);
      await c.read(membersProvider.notifier).resetMfa('m1');
      final rows = c.read(membersProvider).value!;
      expect(rows.map((m) => m.mfaEnabled), [false, true]);
    });

    test('departments / roles mutations reload the list', () async {
      final a = RouteAdapter({
        'GET /admin/departments': const Reply(200, []),
        'POST /admin/departments': const Reply(201, {}),
        'PATCH /admin/departments/d1': const Reply(200, {}),
        'DELETE /admin/departments/d1': const Reply(200, {}),
        'GET /admin/roles': const Reply(200, []),
        'POST /admin/roles': const Reply(201, {}),
        'PATCH /admin/roles/r1': const Reply(200, {}),
      });
      final c = _container(a);
      await c.read(departmentsProvider.future);
      final d = c.read(departmentsProvider.notifier);
      await d.create({'name': 'A'});
      await d.edit('d1', {'name': 'B'});
      await d.remove('d1');
      expect(a.calls('GET', '/admin/departments'), hasLength(4));

      await c.read(rolesProvider.future);
      final r = c.read(rolesProvider.notifier);
      await r.create({'name': 'QA'});
      await r.edit('r1', {'name': 'QA2'});
      expect(a.calls('GET', '/admin/roles'), hasLength(3));
    });

    test('invitations: mutations return the server result and reload', () async {
      final a = RouteAdapter({
        'GET /admin/invitations': const Reply(200, [
          {'_id': 'i1', 'email': 'n@acme.com', 'status': 'expired'}
        ]),
        'POST /admin/invitations': const Reply(201, {'emailSent': false}),
        'POST /admin/invitations/i1/resend': const Reply(200, {'emailSent': true}),
        'DELETE /admin/invitations/i1': const Reply(200, {}),
      });
      final c = _container(a);
      final list = await c.read(invitationsProvider.future);
      expect(list.single.isExpired, isTrue);
      final n = c.read(invitationsProvider.notifier);
      final created = await n.create(email: 'x@acme.com');
      expect(created.emailSent, isFalse);
      expect((await n.resend('i1')).emailSent, isTrue);
      await n.revoke('i1');
      expect(a.calls('GET', '/admin/invitations'), hasLength(4));
    });

    test('audit page is keyed by page number', () async {
      final a = RouteAdapter({
        'GET /admin/audit': (RecordedRequest r) =>
            Reply(200, {'items': [], 'total': 40, 'page': r.query['page']}),
      });
      final c = _container(a);
      expect((await c.read(auditLogProvider(1).future)).page, 1);
      expect((await c.read(auditLogProvider(0).future)).page, 0);
    });
  });
}
