import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/admin/data/models/admin_models.dart';
import 'package:platform_client/features/admin/ui/widgets/member_edit_dialog.dart';
import 'package:platform_client/features/admin/utils/role_guard.dart';
import 'package:platform_client/l10n/app_localizations.dart';

const _owner = Role(id: 'o', name: 'Owner', isPreset: true, permissions: {});
const _admin = Role(id: 'a', name: 'Admin', isPreset: true, permissions: {});
const _member = Role(id: 'm', name: 'Member', isPreset: true, permissions: {});
const _roles = [_owner, _admin, _member];
const _support = Department(id: 'd-support', name: 'Support');
const _finance = Department(id: 'd-finance', name: 'Finance');

/// Opens the dialog and returns a future of what Save/Cancel returned.
Future<Future<MemberEditResult?>> _open(
  WidgetTester tester, {
  required Member member,
  required bool callerIsOwner,
  required MemberRoleLock? lock,
  List<Department> departments = const [],
}) async {
  late Future<MemberEditResult?> result;
  await tester.pumpWidget(MaterialApp(
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    locale: const Locale('en'),
    home: Scaffold(
      body: Builder(
        builder: (ctx) => TextButton(
          onPressed: () => result = MemberEditDialog.show(
            ctx,
            member: member,
            roles: _roles,
            departments: departments,
            canRoles: true,
            canDepts: departments.isNotEmpty,
            callerIsOwner: callerIsOwner,
            roleLock: lock,
          ),
          child: const Text('open'),
        ),
      ),
    ),
  ));
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  return result;
}

CheckboxListTile _deptTile(WidgetTester tester, String name) =>
    tester.widget<CheckboxListTile>(
        find.widgetWithText(CheckboxListTile, name));

TextButton _saveButton(WidgetTester tester, AppLocalizations l10n) =>
    tester.widget<TextButton>(find.widgetWithText(TextButton, l10n.adminSave));

void main() {
  group('role guard', () {
    test('hides the Owner role unless the caller is Owner', () {
      expect(assignableRoles(_roles, callerIsOwner: false).map((r) => r.name),
          ['Admin', 'Member']);
      expect(assignableRoles(_roles, callerIsOwner: true).map((r) => r.name),
          ['Owner', 'Admin', 'Member']);
    });

    test('locks your own row and (for non-Owners) an Owner row', () {
      expect(
          memberRoleLock(isSelf: true, targetIsOwner: false, callerIsOwner: true),
          MemberRoleLock.self);
      expect(
          memberRoleLock(
              isSelf: false, targetIsOwner: true, callerIsOwner: false),
          MemberRoleLock.owner);
      expect(
          memberRoleLock(isSelf: false, targetIsOwner: true, callerIsOwner: true),
          isNull);
      expect(
          memberRoleLock(
              isSelf: false, targetIsOwner: false, callerIsOwner: false),
          isNull);
    });

    test('block / unblock: only an Owner blocks an Owner', () {
      bool can({
        bool self = false,
        bool callerOwner = false,
        bool manager = true,
        bool targetOwner = true,
        bool blocked = false,
      }) =>
          canToggleMemberBlock(
            isSelf: self,
            callerIsOwner: callerOwner,
            callerCanManageMembers: manager,
            targetIsOwner: targetOwner,
            targetBlocked: blocked,
          );
      // OWNER_BLOCK_FORBIDDEN for a non-Owner.
      expect(can(), isFalse);
      expect(can(callerOwner: true), isTrue);
      // A member manager blocks anyone else.
      expect(can(targetOwner: false), isTrue);
      // The server only guards blocking, so unblocking an Owner stays.
      expect(can(blocked: true), isTrue);
      // Never on your own row or without MANAGE_MEMBERS.
      expect(can(callerOwner: true, self: true), isFalse);
      expect(can(targetOwner: false, manager: false), isFalse);
    });
  });

  group('MemberEditDialog', () {
    testWidgets("Owner row for a non-Owner: departments and Save are locked",
        (tester) async {
      await _open(
        tester,
        member: const Member(
            id: 'o1', displayName: 'Olga', email: 'o@x.io', roleId: 'o',
            departmentIds: ['d-support']),
        callerIsOwner: false,
        lock: MemberRoleLock.owner,
        departments: const [_support, _finance],
      );
      final l10n = AppLocalizations.of(
          tester.element(find.byType(MemberEditDialog)));

      expect(_deptTile(tester, 'Support').onChanged, isNull);
      expect(_deptTile(tester, 'Support').value, isTrue);
      expect(_deptTile(tester, 'Finance').onChanged, isNull);
      expect(find.text(l10n.adminMemberDepartmentsLockedOwner), findsOneWidget);
      expect(_saveButton(tester, l10n).onPressed, isNull);

      // Taps go nowhere and the dialog stays open.
      await tester.tap(find.text('Finance'));
      await tester.tap(find.text(l10n.adminSave));
      await tester.pumpAndSettle();
      expect(_deptTile(tester, 'Finance').value, isFalse);
      expect(find.byType(MemberEditDialog), findsOneWidget);
    });

    testWidgets("Owner row for an Owner: everything stays editable",
        (tester) async {
      final result = await _open(
        tester,
        member: const Member(
            id: 'o1', displayName: 'Olga', email: 'o@x.io', roleId: 'o',
            departmentIds: ['d-support']),
        callerIsOwner: true,
        lock: null,
        departments: const [_support, _finance],
      );
      final l10n = AppLocalizations.of(
          tester.element(find.byType(MemberEditDialog)));

      expect(find.text(l10n.adminMemberDepartmentsLockedOwner), findsNothing);
      await tester.tap(find.text('Finance'));
      await tester.pumpAndSettle();
      await tester.tap(find.text(l10n.adminSave));
      await tester.pumpAndSettle();
      expect((await result)!.departmentIds, ['d-support', 'd-finance']);
    });

    testWidgets('regular member for a non-Owner: everything stays editable',
        (tester) async {
      final result = await _open(
        tester,
        member: const Member(
            id: 'b', displayName: 'Bob', email: 'b@x.io', roleId: 'm',
            departmentIds: []),
        callerIsOwner: false,
        lock: null,
        departments: const [_support, _finance],
      );
      final l10n = AppLocalizations.of(
          tester.element(find.byType(MemberEditDialog)));

      expect(find.text(l10n.adminMemberDepartmentsLockedOwner), findsNothing);
      await tester.tap(find.text('Finance'));
      await tester.pumpAndSettle();
      await tester.tap(find.text(l10n.adminSave));
      await tester.pumpAndSettle();
      expect((await result)!.departmentIds, ['d-finance']);
    });

    testWidgets('own row: role locked, departments stay editable',
        (tester) async {
      final result = await _open(
        tester,
        member: const Member(
            id: 'me', displayName: 'Me', email: 'me@x.io', roleId: 'a',
            departmentIds: []),
        callerIsOwner: false,
        lock: MemberRoleLock.self,
        departments: const [_support, _finance],
      );
      final l10n = AppLocalizations.of(
          tester.element(find.byType(MemberEditDialog)));

      expect(find.text(l10n.adminMemberDepartmentsLockedOwner), findsNothing);
      await tester.tap(find.text('Support'));
      await tester.pumpAndSettle();
      await tester.tap(find.text(l10n.adminSave));
      await tester.pumpAndSettle();
      final saved = await result;
      expect(saved!.roleId, isNull);
      expect(saved.departmentIds, ['d-support']);
    });

    testWidgets('own row: picker disabled, hint shown, no role sent',
        (tester) async {
      final result = await _open(
        tester,
        member: const Member(
            id: 'me', displayName: 'Me', email: 'me@x.io', roleId: 'a',
            departmentIds: []),
        callerIsOwner: false,
        lock: MemberRoleLock.self,
      );
      final l10n = AppLocalizations.of(
          tester.element(find.byType(MemberEditDialog)));

      final dropdown = tester.widget<DropdownButton<String?>>(
          find.byType(DropdownButton<String?>));
      expect(dropdown.onChanged, isNull);
      expect(find.text(l10n.adminMemberRoleLockedSelf), findsOneWidget);

      await tester.tap(find.text(l10n.adminSave));
      await tester.pumpAndSettle();
      final saved = await result;
      expect(saved, isNotNull);
      expect(saved!.roleId, isNull);
    });

    testWidgets("Owner row for a non-Owner: locked with the Owner hint",
        (tester) async {
      await _open(
        tester,
        member: const Member(
            id: 'o1', displayName: 'Olga', email: 'o@x.io', roleId: 'o',
            departmentIds: []),
        callerIsOwner: false,
        lock: MemberRoleLock.owner,
      );
      final l10n = AppLocalizations.of(
          tester.element(find.byType(MemberEditDialog)));
      expect(find.text(l10n.adminMemberRoleLockedOwner), findsOneWidget);
      // The current role still renders even though Owner isn't assignable.
      expect(find.text('Owner'), findsOneWidget);
    });

    testWidgets('open row for a non-Owner never offers the Owner role',
        (tester) async {
      final result = await _open(
        tester,
        member: const Member(
            id: 'b', displayName: 'Bob', email: 'b@x.io', roleId: 'm',
            departmentIds: []),
        callerIsOwner: false,
        lock: null,
      );
      final dropdown = tester.widget<DropdownButton<String?>>(
          find.byType(DropdownButton<String?>));
      expect(dropdown.onChanged, isNotNull);
      expect(dropdown.items!.map((i) => i.value), [null, 'a', 'm']);

      final l10n = AppLocalizations.of(
          tester.element(find.byType(MemberEditDialog)));
      await tester.tap(find.text(l10n.adminSave));
      await tester.pumpAndSettle();
      expect((await result)!.roleId, 'm');
    });
  });
}
