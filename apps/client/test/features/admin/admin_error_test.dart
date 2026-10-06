import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/admin/data/models/admin_models.dart';
import 'package:platform_client/features/admin/ui/widgets/cap_label.dart';
import 'package:platform_client/features/admin/utils/admin_error.dart';
import 'package:platform_client/l10n/app_localizations.dart';

void main() {
  final l = lookupAppLocalizations(const Locale('en'));

  group('roleGrantExceedsMessage', () {
    test('lists the localized names of the missing capabilities', () {
      final msg = roleGrantExceedsMessage(l, {
        'capabilities': [Cap.manageRoles, Cap.viewConfidentialContext],
      });
      expect(msg, contains(capabilityLabelOf(l, Cap.manageRoles)));
      expect(msg, contains(capabilityLabelOf(l, Cap.viewConfidentialContext)));
      expect(msg, isNot(contains('MANAGE_ROLES')));
      expect(msg, isNot(contains('VIEW_CONFIDENTIAL_CONTEXT')));
    });

    test('drops unknown capability keys instead of showing them raw', () {
      final msg = roleGrantExceedsMessage(l, {
        'capabilities': ['SOME_FUTURE_CAP', Cap.manageMembers],
      });
      expect(msg, contains(capabilityLabelOf(l, Cap.manageMembers)));
      expect(msg, isNot(contains('SOME_FUTURE_CAP')));
    });

    test('falls back to the generic sentence without usable params', () {
      expect(roleGrantExceedsMessage(l, null),
          l.authErrRoleGrantExceedsOwnPermissionsGeneric);
      expect(
          roleGrantExceedsMessage(l, {
            'capabilities': ['NOPE']
          }),
          l.authErrRoleGrantExceedsOwnPermissionsGeneric);
    });
  });

  test('the AI-context capabilities have real labels, not their codes', () {
    for (final cap in [
      Cap.manageAiContext,
      Cap.viewInternalContext,
      Cap.viewConfidentialContext,
    ]) {
      expect(capabilityLabelOf(l, cap), isNot(cap));
    }
  });
}
