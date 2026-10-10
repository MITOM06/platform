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
      roleId: 'r-member', departmentIds: [], mfaEnabled: true),
  Member(
      id: 'u-lead', displayName: 'Leo', email: 'l@acme.com',
      roleId: 'r-lead', departmentIds: [], mfaEnabled: true),
  // No role assigned → a plain Member.
  Member(
      id: 'u-norole', displayName: 'Nina', email: 'n@acme.com',
      departmentIds: [], mfaEnabled: true),
  // Not enrolled yet → nothing to reset, whoever looks.
  Member(
      id: 'u-new', displayName: 'Ned', email: 'ned@acme.com',
      roleId: 'r-member', departmentIds: []),
];

class _FakeAdminRepo implements AdminRepository {
  _FakeAdminRepo(this.callerRole, {this.rolesVisible = true});
  final String callerRole;

  /// `false` → `GET /admin/roles` is refused (caller lacks MANAGE_ROLES).
  final bool rolesVisible;
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
  Future<List<Role>> listRoles() async {
    if (!rolesVisible) throw StateError('MANAGE_ROLES required');
    return const [_ownerRole, _adminRole, _memberRole, _deptLeadRole];
  }

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
  bool rolesVisible = true,
}) async {
  tester.view.physicalSize = const Size(1200, 3000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  final repo = _FakeAdminRepo(callerRole, rolesVisible: rolesVisible);
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

    test('reset rule: Owner → anyone else; Admin → non-admin members only',
        () {
      bool can({
        bool self = false,
        bool owner = false,
        bool manager = true,
        bool enrolled = true,
        bool privileged = false,
      }) =>
          canResetMemberMfa(
            isSelf: self,
            callerIsOwner: owner,
            callerCanManageMembers: manager,
            targetMfaEnabled: enrolled,
            targetPrivileged: privileged,
          );
      // Owner: anyone but themself, admins included.
      expect(can(owner: true), isTrue);
      expect(can(owner: true, privileged: true), isTrue);
      expect(can(owner: true, self: true), isFalse);
      // Admin (MANAGE_MEMBERS, not Owner): members only.
      expect(can(), isTrue);
      expect(can(privileged: true), isFalse);
      expect(can(self: true), isFalse);
      // No MANAGE_MEMBERS → never.
      expect(can(manager: false), isFalse);
      // Nothing to reset on a member who never enrolled.
      expect(can(owner: true, enrolled: false), isFalse);
      expect(can(enrolled: false), isFalse);
    });

    test('an unresolvable role counts as privileged; no role is a Member', () {
      expect(isPrivilegedTarget(roleId: null, role: null), isFalse);
      expect(isPrivilegedTarget(roleId: 'r-x', role: null), isTrue);
      expect(
          isPrivilegedTarget(roleId: 'r-member', role: _memberRole), isFalse);
      expect(isPrivilegedTarget(roleId: 'r-admin', role: _adminRole), isTrue);
      expect(isPrivilegedTarget(roleId: 'r-lead', role: _deptLeadRole), isTrue);
    });

    test('Member parses mfaEnabled (absent → false) and resets it', () {
      final m = Member.fromJson(const {'id': 'x', 'mfaEnabled': true});
      expect(m.mfaEnabled, isTrue);
      expect(m.withMfaReset().mfaEnabled, isFalse);
      expect(Member.fromJson(const {'id': 'x'}).mfaEnabled, isFalse);
    });
  });

  group('MembersPanel', () {
    testWidgets('Owner: reset on every other enrolled row', (tester) async {
      await _pump(tester, callerRole: 'Owner', selfId: 'u-owner');

      expect(_reset('u-owner'), findsNothing); // own row
      expect(_reset('u-admin'), findsOneWidget);
      expect(_reset('u-lead'), findsOneWidget); // admin-like custom role
      expect(_reset('u-member'), findsOneWidget); // enrolled Member (opt-in)
      expect(_reset('u-norole'), findsOneWidget);
      expect(_reset('u-new'), findsNothing); // never enrolled

      expect(_badge('u-owner'), findsOneWidget);
      expect(_badge('u-member'), findsOneWidget);
      expect(_badge('u-new'), findsNothing);
    });

    testWidgets('Admin: reset only on non-admin members, never on own row',
        (tester) async {
      await _pump(tester, callerRole: 'Admin', selfId: 'u-admin');

      expect(_reset('u-owner'), findsNothing);
      expect(_reset('u-admin'), findsNothing); // own row
      expect(_reset('u-lead'), findsNothing); // admin-like custom role
      expect(_reset('u-member'), findsOneWidget);
      expect(_reset('u-norole'), findsOneWidget);
      expect(_reset('u-new'), findsNothing);
      // The badge is informational for every admin.
      expect(_badge('u-owner'), findsOneWidget);
    });

    testWidgets('Admin who cannot list roles: only role-less rows',
        (tester) async {
      await _pump(tester,
          callerRole: 'Admin', selfId: 'u-admin', rolesVisible: false);

      // Unknown roles may be Owner / Admin-like → never offered.
      for (final id in ['u-owner', 'u-lead', 'u-member']) {
        expect(_reset(id), findsNothing, reason: id);
      }
      expect(_reset('u-norole'), findsOneWidget);
    });

    testWidgets('reset asks for confirmation, then clears the badge',
        (tester) async {
      final repo = await _pump(tester, callerRole: 'Owner', selfId: 'u-owner');
      final l10n =
          AppLocalizations.of(tester.element(find.byType(MembersPanel)));

      await tester.tap(_reset('u-admin'));
      await tester.pumpAndSettle();
      // Admin-like target: 2FA is mandatory → set up again at next sign-in.
      expect(find.text(l10n.adminMfaResetConfirm('Adam')), findsOneWidget);
      expect(find.text(l10n.adminMfaResetConfirmOptional('Adam')), findsNothing);

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
      // Not enrolled any more → nothing left to reset.
      expect(_reset('u-admin'), findsNothing);
    });

    testWidgets('an Admin resets a member through the same confirm flow',
        (tester) async {
      final repo = await _pump(tester, callerRole: 'Admin', selfId: 'u-admin');
      final l10n =
          AppLocalizations.of(tester.element(find.byType(MembersPanel)));

      await tester.tap(_reset('u-member'));
      await tester.pumpAndSettle();
      // Member target (contract 15): 2FA is optional → turned off, and they
      // can turn it on again themselves.
      expect(find.text(l10n.adminMfaResetConfirmOptional('Mia')), findsOneWidget);
      expect(find.text(l10n.adminMfaResetConfirm('Mia')), findsNothing);
      await tester.tap(find.descendant(
        of: find.byType(AlertDialog),
        matching: find.text(l10n.adminMfaReset),
      ));
      await tester.pumpAndSettle();

      expect(repo.resetCalls, ['u-member']);
      expect(_badge('u-member'), findsNothing);
    });

    testWidgets('the confirm wording follows the target role (contract 15)',
        (tester) async {
      await _pump(tester, callerRole: 'Owner', selfId: 'u-owner');
      final l10n =
          AppLocalizations.of(tester.element(find.byType(MembersPanel)));

      Future<void> expectConfirm(String id, String expected) async {
        await tester.tap(_reset(id));
        await tester.pumpAndSettle();
        expect(
          find.descendant(
              of: find.byType(AlertDialog), matching: find.text(expected)),
          findsOneWidget,
          reason: id,
        );
        await tester.tap(find.text(l10n.adminCancel));
        await tester.pumpAndSettle();
      }

      await expectConfirm('u-admin', l10n.adminMfaResetConfirm('Adam'));
      // Admin-like custom role: still mandatory.
      await expectConfirm('u-lead', l10n.adminMfaResetConfirm('Leo'));
      await expectConfirm('u-member', l10n.adminMfaResetConfirmOptional('Mia'));
      // No role assigned → a plain Member.
      await expectConfirm(
          'u-norole', l10n.adminMfaResetConfirmOptional('Nina'));
      expect(l10n.adminMfaResetConfirmOptional('Mia'), contains('turned off'));
    });

    testWidgets('an unresolvable role gets the stricter (required) wording',
        (tester) async {
      await _pump(tester,
          callerRole: 'Owner', selfId: 'u-owner', rolesVisible: false);
      final l10n =
          AppLocalizations.of(tester.element(find.byType(MembersPanel)));

      await tester.tap(_reset('u-member'));
      await tester.pumpAndSettle();
      expect(find.text(l10n.adminMfaResetConfirm('Mia')), findsOneWidget);
    });
  });
}
