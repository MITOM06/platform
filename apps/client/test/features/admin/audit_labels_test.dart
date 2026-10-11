import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/admin/data/models/admin_models.dart';
import 'package:platform_client/features/admin/utils/audit_labels.dart';
import 'package:platform_client/l10n/app_localizations.dart';

void main() {
  final l = lookupAppLocalizations(const Locale('en'));

  AuditLogEntry entry({
    String actorId = '64b7f0c2a1b2c3d4e5f60718',
    String? actorName = 'Dave Lead',
    String action = 'member.update',
    String targetType = 'member',
    String? targetId = '64b7f0c2a1b2c3d4e5f60719',
    String? targetName,
  }) =>
      AuditLogEntry(
        id: 'a1',
        actorId: actorId,
        actorName: actorName,
        action: action,
        targetType: targetType,
        targetId: targetId,
        targetName: targetName,
      );

  group('auditActionLabel', () {
    test('known actions get their localized label', () {
      expect(
          auditActionLabel(l, 'member.block'), l.adminAuditActionMemberBlock);
      expect(auditActionLabel(l, 'custom_mcp.delete'),
          l.adminAuditActionCustomMcpDelete);
    });

    test('unknown actions never show the raw code', () {
      expect(auditActionLabel(l, 'something.new'), l.adminAuditActionOther);
    });

    test('SSO enforcement, 2FA and preset-role actions have their own labels',
        () {
      final expected = {
        'sso.enforcement_changed': l.adminAuditActionSsoEnforcementChanged,
        'mfa.enrolled': l.adminAuditActionMfaEnrolled,
        'mfa.disabled': l.adminAuditActionMfaDisabled,
        'mfa.reset': l.adminAuditActionMfaReset,
        'mfa.backup_codes_regenerated':
            l.adminAuditActionMfaBackupCodesRegenerated,
        'mfa.verified_backup_code': l.adminAuditActionMfaVerifiedBackupCode,
        'role.preset_removed': l.adminAuditActionRolePresetRemoved,
      };
      for (final e in expected.entries) {
        expect(auditActionLabel(l, e.key), e.value, reason: e.key);
        expect(auditActionLabel(l, e.key), isNot(l.adminAuditActionOther),
            reason: e.key);
      }
      expect(expected.values.toSet(), hasLength(expected.length));
    });
  });

  group('auditActorLabel', () {
    test('the system actor is "System"', () {
      expect(auditActorLabel(l, entry(actorId: 'system', actorName: null)),
          l.adminAuditSystem);
    });

    test('a name that is itself an id falls back to "A former member"', () {
      final e = entry(actorName: '64b7f0c2a1b2c3d4e5f60718');
      expect(auditActorLabel(l, e), l.adminAuditFormerMember);
    });

    test('a real name is shown', () {
      expect(auditActorLabel(l, entry()), 'Dave Lead');
    });
  });

  group('auditTargetLabel', () {
    test('uses the server targetName', () {
      expect(auditTargetLabel(l, entry(targetName: 'Alice')), 'Alice');
    });

    test('a missing or id-like targetName gets the target-type label', () {
      expect(auditTargetLabel(l, entry()), l.adminAuditTargetMember);
      expect(
        auditTargetLabel(l, entry(targetName: '64b7f0c2a1b2c3d4e5f60719')),
        l.adminAuditTargetMember,
      );
      expect(
        auditTargetLabel(
            l, entry(targetType: 'connector', targetName: 'mcp__x')),
        l.adminAuditTargetConnector,
      );
    });
  });
}
