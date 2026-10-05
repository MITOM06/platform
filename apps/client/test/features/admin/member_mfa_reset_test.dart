import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/admin/data/admin_repository.dart';
import 'package:platform_client/features/admin/data/models/admin_models.dart';
import 'package:platform_client/features/admin/data/models/invitation_models.dart';
import 'package:platform_client/features/admin/ui/widgets/members_panel.dart';
import 'package:platform_client/features/admin/utils/role_guard.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/l10n/app_localizations.dart';

const _ownerRole =
    Role(id: 'r-owner', name: 'Owner', isPreset: true, permissions: {});
const _adminRole =
    Role(id: 'r-admin', name: 'Admin', isPreset: true, permissions: {});
const _memberRole =
    Role(id: 'r-member', name: 'Member', isPreset: true, permissions: {});
const _deptLeadRole = Role(
  id: 'r-lead',
  name: 'Team lead',
  isPreset: false,
  permissions: {Cap.manageMembers: true},
);

const _members = [
  Member(
      id: 'u-owner', displayName: 'Olga', email: 'o@acme.com',
      roleId: 'r-owner', departmentIds: [], mfaEnabled: true),
  Member(
      id: 'u-admin', displayName: 'Adam', email: 'a@acme.com',
      roleId: 'r-admin', departmentIds: [], mfaEnabled: true),
  Member(
      id: 'u-member', displayName: 'Mia', email: 'm@acme.com',
      roleId: 'r-member', departmentIds: []),
  Member(
      id: 'u-lead', displayName: 'Leo', email: 'l@acme.com',
      roleId: 'r-lead', departmentIds: []),
];

class _FakeAdminRepo implements AdminRepository {
  _FakeAdminRepo(this.callerRole);
  final String callerRole;
  final resetCalls = <String>[];

  @override
  Future<MeCapabilities> capabilities() async => MeCapabilities(
        role: callerRole,
        perms: const [Cap.manageMembers, Cap.manageRoles],
        depts: const [],
        workspace: const WorkspacePublicConfig(
            name: 'Acme', features: {}, connectorAllowList: []),
      );

  @override
  Future<List<Member>> listMembers() async => _members;

  @override
  Future<List<Role>> listRoles() async =>
      const [_ownerRole, _adminRole, _memberRole, _deptLeadRole];

  @override
  Future<List<Invitation>> listInvitations({String? status}) async => const [];

  @override
  Future<void> resetMemberMfa(String id) async => resetCalls.add(id);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _TestAuth extends AuthNotifier {
  _TestAuth(this._user);
  final UserModel _user;

  @override
  Future<AuthState> build() async => AuthAuthenticated(_user);
}

Future<_FakeAdminRepo> _pump(
  WidgetTester tester, {
  required String callerRole,
  required String selfId,
}) async {
  tester.view.physicalSize = const Size(1200, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  final repo = _FakeAdminRepo(callerRole);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      adminRepositoryProvider.overrideWithValue(repo),
      authNotifierProvider.overrideWith(() => _TestAuth(
          UserModel(id: selfId, email: 'me@acme.com', displayName: 'Me'))),
    ],
    child: const MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: Locale('en'),
      home: Scaffold(body: MembersPanel()),
    ),
  ));
  await tester.pumpAndSettle();
  return repo;
}

Finder _reset(String id) => find.byKey(ValueKey('member-mfa-reset-$id'));
Finder _badge(String id) => find.byKey(ValueKey('member-mfa-badge-$id'));

void main() {
  group('rules', () {
    test('privileged = Owner, Admin, or an admin-like capability', () {
      expect(isPrivilegedRole(_ownerRole), isTrue);
      expect(isPrivilegedRole(_adminRole), isTrue);
      expect(isPrivilegedRole(_deptLeadRole), isTrue);
      expect(isPrivilegedRole(_memberRole), isFalse);
      expect(isPrivilegedRole(null), isFalse);
    });

    test('reset only for an Owner, never on their own row', () {
      bool can({
        bool self = false,
        bool owner = true,
        bool enrolled = true,
        bool privileged = true,
      }) =>
          canResetMemberMfa(
            isSelf: self,
            callerIsOwner: owner,
            targetMfaEnabled: enrolled,
            targetPrivileged: privileged,
          );
      expect(can(), isTrue);
      expect(can(self: true), isFalse);
      expect(can(owner: false), isFalse);
      expect(can(enrolled: false), isTrue); // privileged, not yet enrolled
      expect(can(privileged: false), isTrue); // enrolled, since demoted
      expect(can(enrolled: false, privileged: false), isFalse);
    });

    test('Member parses mfaEnabled (absent → false) and resets it', () {
      final m = Member.fromJson(const {'id': 'x', 'mfaEnabled': true});
      expect(m.mfaEnabled, isTrue);
      expect(m.withMfaReset().mfaEnabled, isFalse);
      expect(Member.fromJson(const {'id': 'x'}).mfaEnabled, isFalse);
    });
  });

  group('MembersPanel', () {
    testWidgets('Owner: reset on other privileged rows, not on own row',
        (tester) async {
      await _pump(tester, callerRole: 'Owner', selfId: 'u-owner');

      expect(_reset('u-owner'), findsNothing); // own row
      expect(_reset('u-admin'), findsOneWidget);
      expect(_reset('u-lead'), findsOneWidget); // admin-like custom role
      expect(_reset('u-member'), findsNothing); // not privileged, no 2FA

      expect(_badge('u-owner'), findsOneWidget);
      expect(_badge('u-admin'), findsOneWidget);
      expect(_badge('u-member'), findsNothing);
    });

    testWidgets('a non-Owner admin never sees "Reset 2FA"', (tester) async {
      await _pump(tester, callerRole: 'Admin', selfId: 'u-admin');

      for (final m in _members) {
        expect(_reset(m.id), findsNothing, reason: m.id);
      }
      // The badge is informational for every admin.
      expect(_badge('u-owner'), findsOneWidget);
    });

    testWidgets('reset asks for confirmation, then clears the badge',
        (tester) async {
      final repo = await _pump(tester, callerRole: 'Owner', selfId: 'u-owner');
      final l10n =
          AppLocalizations.of(tester.element(find.byType(MembersPanel)));

      await tester.tap(_reset('u-admin'));
      await tester.pumpAndSettle();
      expect(find.text(l10n.adminMfaResetConfirm('Adam')), findsOneWidget);

      // Cancel does nothing.
      await tester.tap(find.text(l10n.adminCancel));
      await tester.pumpAndSettle();
      expect(repo.resetCalls, isEmpty);

      await tester.tap(_reset('u-admin'));
      await tester.pumpAndSettle();
      await tester.tap(find.descendant(
        of: find.byType(AlertDialog),
        matching: find.text(l10n.adminMfaReset),
      ));
      await tester.pumpAndSettle();

      expect(repo.resetCalls, ['u-admin']);
      expect(_badge('u-admin'), findsNothing);
      // Still privileged → the action stays available.
      expect(_reset('u-admin'), findsOneWidget);
    });
  });
}
