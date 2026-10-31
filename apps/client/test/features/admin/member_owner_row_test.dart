import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/admin/data/admin_repository.dart';
import 'package:platform_client/features/admin/data/models/admin_models.dart';
import 'package:platform_client/features/admin/data/models/invitation_models.dart';
import 'package:platform_client/features/admin/ui/widgets/member_edit_dialog.dart';
import 'package:platform_client/features/admin/ui/widgets/members_panel.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/l10n/app_localizations.dart';

const _ownerRole =
    Role(id: 'r-owner', name: 'Owner', isPreset: true, permissions: {});
const _memberRole =
    Role(id: 'r-member', name: 'Member', isPreset: true, permissions: {});

const _members = [
  Member(
      id: 'u-owner', displayName: 'Olga', email: 'o@acme.com',
      roleId: 'r-owner', departmentIds: []),
  Member(
      id: 'u-blocked-owner', displayName: 'Bea', email: 'b@acme.com',
      roleId: 'r-owner', departmentIds: [], status: 'blocked'),
  Member(
      id: 'u-member', displayName: 'Mia', email: 'm@acme.com',
      roleId: 'r-member', departmentIds: []),
  Member(
      id: 'u-me', displayName: 'Me', email: 'me@acme.com',
      roleId: 'r-member', departmentIds: []),
];

class _FakeAdminRepo implements AdminRepository {
  _FakeAdminRepo(this.callerRole, {required this.rolesVisible});
  final String callerRole;

  /// `false` → `GET /admin/roles` is refused (caller lacks MANAGE_ROLES).
  final bool rolesVisible;

  @override
  Future<MeCapabilities> capabilities() async => MeCapabilities(
        role: callerRole,
        perms: [
          Cap.manageMembers,
          Cap.manageDepartments,
          if (rolesVisible) Cap.manageRoles,
        ],
        depts: const [],
        workspace: const WorkspacePublicConfig(
            name: 'Acme', features: {}, connectorAllowList: []),
      );

  @override
  Future<List<Member>> listMembers() async => _members;

  @override
  Future<List<Role>> listRoles() async {
    if (!rolesVisible) throw StateError('MANAGE_ROLES required');
    return const [_ownerRole, _memberRole];
  }

  @override
  Future<List<Department>> listDepartments() async =>
      const [Department(id: 'd-support', name: 'Support')];

  @override
  Future<List<Invitation>> listInvitations({String? status}) async => const [];

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _TestAuth extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthAuthenticated(
      UserModel(id: 'u-me', email: 'me@acme.com', displayName: 'Me'));
}

Future<void> _pump(
  WidgetTester tester, {
  required String callerRole,
  bool rolesVisible = true,
}) async {
  tester.view.physicalSize = const Size(1200, 3000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(ProviderScope(
    overrides: [
      adminRepositoryProvider.overrideWithValue(
          _FakeAdminRepo(callerRole, rolesVisible: rolesVisible)),
      authNotifierProvider.overrideWith(_TestAuth.new),
    ],
    child: const MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: Locale('en'),
      home: Scaffold(body: MembersPanel()),
    ),
  ));
  await tester.pumpAndSettle();
}

Finder _block(String id) => find.byKey(ValueKey('member-block-$id'));

Future<AppLocalizations> _openEdit(WidgetTester tester, String id) async {
  await tester.tap(find.byKey(ValueKey('member-edit-$id')));
  await tester.pumpAndSettle();
  return AppLocalizations.of(tester.element(find.byType(MemberEditDialog)));
}

void main() {
  group("MembersPanel: actions on an Owner's row", () {
    testWidgets('a non-Owner gets no block action and a read-only edit dialog',
        (tester) async {
      await _pump(tester, callerRole: 'Admin');
      expect(_block('u-owner'), findsNothing);

      final l10n = await _openEdit(tester, 'u-owner');
      expect(find.text(l10n.adminMemberDepartmentsLockedOwner), findsOneWidget);
      final save = tester
          .widget<TextButton>(find.widgetWithText(TextButton, l10n.adminSave));
      expect(save.onPressed, isNull);
    });

    testWidgets('an Owner keeps both actions', (tester) async {
      await _pump(tester, callerRole: 'Owner');
      expect(_block('u-owner'), findsOneWidget);

      final l10n = await _openEdit(tester, 'u-owner');
      expect(find.text(l10n.adminMemberDepartmentsLockedOwner), findsNothing);
      final save = tester
          .widget<TextButton>(find.widgetWithText(TextButton, l10n.adminSave));
      expect(save.onPressed, isNotNull);
    });

    testWidgets('a non-Owner still blocks and edits a regular member',
        (tester) async {
      await _pump(tester, callerRole: 'Admin');
      expect(_block('u-member'), findsOneWidget);

      final l10n = await _openEdit(tester, 'u-member');
      expect(find.text(l10n.adminMemberDepartmentsLockedOwner), findsNothing);
      final save = tester
          .widget<TextButton>(find.widgetWithText(TextButton, l10n.adminSave));
      expect(save.onPressed, isNotNull);
    });

    testWidgets(
        'a non-Owner can still unblock a blocked Owner: the server only guards blocking',
        (tester) async {
      await _pump(tester, callerRole: 'Admin');
      expect(_block('u-blocked-owner'), findsOneWidget);
    });

    testWidgets('nobody gets block on their own row', (tester) async {
      await _pump(tester, callerRole: 'Owner');
      expect(_block('u-me'), findsNothing);
    });

    testWidgets('without the role list the block action stays on every other row',
        (tester) async {
      await _pump(tester, callerRole: 'Team lead', rolesVisible: false);
      // Any of them may be an ordinary member; the server refuses the Owner.
      expect(_block('u-owner'), findsOneWidget);
      expect(_block('u-member'), findsOneWidget);
      expect(_block('u-me'), findsNothing);
    });
  });
}
