import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/auth/domain/invitation_preview.dart';

void main() {
  const token = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';

  group('extractInviteToken', () {
    test('accepts a bare token', () {
      expect(extractInviteToken(token), token);
      expect(extractInviteToken('  $token  '), token);
    });

    test('extracts the token from the web invite URL', () {
      expect(extractInviteToken('https://pon.acme.com/invite/$token'), token);
      expect(extractInviteToken('https://pon.acme.com/invite/$token/'), token);
    });

    test('extracts the token from the app deep link', () {
      expect(extractInviteToken('platform://invite?token=$token'), token);
    });

    test('rejects input without a token', () {
      expect(extractInviteToken(''), isNull);
      expect(extractInviteToken('hello'), isNull);
      expect(extractInviteToken('https://pon.acme.com/login'), isNull);
      expect(extractInviteToken('https://pon.acme.com/invite/'), isNull);
      expect(extractInviteToken('https://pon.acme.com/invite/short'), isNull);
      expect(extractInviteToken('https://pon.acme.com/invite/a%2Fb..c'), isNull);
    });
  });

  test('isValidInviteToken rejects path-like or short values', () {
    expect(isValidInviteToken(token), isTrue);
    expect(isValidInviteToken('../../etc/passwd'), isFalse);
    expect(isValidInviteToken('abc'), isFalse);
  });

  test('InvitationPreview.fromJson parses the contract shape', () {
    final p = InvitationPreview.fromJson(const {
      'email': 'jane@acme.com',
      'workspaceName': 'Acme',
      'inviterName': 'Khang',
      'roleName': 'Member',
      'expiresAt': '2026-10-08T09:00:00.000Z',
    });
    expect(p.email, 'jane@acme.com');
    expect(p.workspaceName, 'Acme');
    expect(p.inviterName, 'Khang');
    expect(p.roleName, 'Member');
    expect(p.expiresAt, DateTime.utc(2026, 10, 8, 9));
  });

  test('InvitationPreview.fromJson keeps a deleted role as null', () {
    final p = InvitationPreview.fromJson(const {
      'email': 'jane@acme.com',
      'workspaceName': 'Acme',
      'inviterName': 'Khang',
      'roleName': null,
      'expiresAt': '2026-10-08T09:00:00.000Z',
    });
    expect(p.roleName, isNull);
  });
}
