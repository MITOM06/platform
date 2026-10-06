import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/domain/mfa_models.dart';
import 'package:platform_client/features/auth/utils/mfa_code.dart';

import 'mfa_test_data.dart';

void main() {
  group('code input rules', () {
    test('TOTP: six digits, spaces forgiven', () {
      expect(isCompleteTotpCode('123456'), isTrue);
      expect(isCompleteTotpCode('123 456'), isTrue);
      expect(normalizeTotpCode(' 12 34 56 '), '123456');
      expect(isCompleteTotpCode('12345'), isFalse);
      expect(isCompleteTotpCode('1234567'), isFalse);
      expect(isCompleteTotpCode('abcdef'), isFalse);
    });

    test('backup code: canonical XXXXX-XXXXX, case/hyphen forgiven', () {
      expect(normalizeBackupCode('abcde-fghij'), 'ABCDE-FGHIJ');
      expect(normalizeBackupCode('ABCDEFGHIJ'), 'ABCDE-FGHIJ');
      expect(normalizeBackupCode(' ab2de 7ghij '), 'AB2DE-7GHIJ');
      expect(normalizeBackupCode('ABCDE-FGHI'), isNull);
      expect(normalizeBackupCode('ABCDE-FGHIJK'), isNull);
      expect(normalizeBackupCode('ABCD!-FGHIJ'), isNull);
    });

    test('backup codes copy as one per line', () {
      expect(backupCodesAsText(['A', 'B']), 'A\nB');
    });
  });

  group('MfaChallenge', () {
    test('parses the MFA_REQUIRED login/exchange body', () {
      final c = MfaChallenge.fromJson(const {
        'code': 'MFA_REQUIRED',
        'mfaToken': 'tok_1',
        'enrollmentRequired': true,
        'user': {'id': 'u1', 'email': 'o@acme.com', 'displayName': 'Olga'},
      });
      expect(c.mfaToken, 'tok_1');
      expect(c.enrollmentRequired, isTrue);
      expect(c.userId, 'u1');
      expect(c.email, 'o@acme.com');
      expect(c.displayName, 'Olga');
    });

    test('enrollmentRequired defaults to verify mode', () {
      final c = MfaChallenge.fromJson(const {'mfaToken': 't'});
      expect(c.enrollmentRequired, isFalse);
      expect(c.email, '');
    });
  });

  group('MfaEnrollment', () {
    test('decodes the server PNG data URL for Image.memory', () {
      const e = MfaEnrollment(
        otpauthUrl: 'otpauth://totp/PON:o@acme.com?secret=ABC&issuer=PON',
        secret: 'ABC',
        qrDataUrl: kTinyPngDataUrl,
      );
      final bytes = e.qrPngBytes;
      expect(bytes, isNotNull);
      // PNG signature.
      expect(bytes!.sublist(0, 4), [0x89, 0x50, 0x4E, 0x47]);
    });

    test('a missing / malformed data URL yields no image', () {
      expect(
        const MfaEnrollment(otpauthUrl: '', secret: 'A', qrDataUrl: '')
            .qrPngBytes,
        isNull,
      );
      expect(
        const MfaEnrollment(
                otpauthUrl: '', secret: 'A', qrDataUrl: 'https://x/qr.png')
            .qrPngBytes,
        isNull,
      );
    });
  });

  group('UserModel 2FA flags', () {
    test('parsed from /me, false when absent, persisted', () {
      final u = UserModel.fromJson(
          const {'id': 'u1', 'mfaEnabled': true, 'mfaRequired': true});
      expect(u.mfaEnabled, isTrue);
      expect(u.mfaRequired, isTrue);
      final restored = UserModel.fromJson(u.toJson());
      expect(restored.mfaEnabled, isTrue);
      expect(restored.mfaRequired, isTrue);

      final legacy = UserModel.fromJson(const {'id': 'u1'});
      expect(legacy.mfaEnabled, isFalse);
      expect(legacy.mfaRequired, isFalse);
    });

    test('withPasswordSet keeps the 2FA flags', () {
      const u = UserModel(
        id: 'u1',
        email: 'a@x.io',
        displayName: 'A',
        mustSetPassword: true,
        mfaEnabled: true,
        mfaRequired: true,
      );
      final done = u.withPasswordSet();
      expect(done.mfaEnabled, isTrue);
      expect(done.mfaRequired, isTrue);
    });
  });
}
