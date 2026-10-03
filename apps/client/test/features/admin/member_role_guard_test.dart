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

/// Opens the dialog and returns a future of what Save/Cancel returned.
Future<Future<MemberEditResult?>> _open(
  WidgetTester tester, {
  required Member member,
  required bool callerIsOwner,
  required MemberRoleLock? lock,
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
            departments: const [],
            canRoles: true,
            canDepts: false,
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
  });

  group('MemberEditDialog', () {
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
