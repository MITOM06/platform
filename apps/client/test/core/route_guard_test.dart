import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/router/route_guard.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/domain/mfa_models.dart';

String? _redirect(
  String path, {
  bool auth = true,
  bool mustSetPassword = false,
  bool onboarded = true,
  bool mfaPending = false,
}) =>
    resolveAuthRedirect(
      path: path,
      isAuthenticated: auth,
      mustSetPassword: mustSetPassword,
      onboardingCompleted: onboarded,
      mfaPending: mfaPending,
    );

const _challenge = MfaChallenge(mfaToken: 'tok', enrollmentRequired: false);
const _user = UserModel(id: 'u1', email: 'a@x.io', displayName: 'A');

void main() {
  group('pending 2FA gate (/mfa)', () {
    test('a pending challenge can only be on /mfa', () {
      for (final path in [
        '/',
        '/login',
        '/legal',
        '/settings',
        '/set-password',
        '/theme-onboarding',
        '/invite/tok_0123456789abcdefghij',
      ]) {
        expect(_redirect(path, auth: false, mfaPending: true), kMfaPath,
            reason: path);
      }
      expect(_redirect(kMfaPath, auth: false, mfaPending: true), isNull);
    });

    test('/mfa without a pending challenge is unreachable', () {
      expect(_redirect(kMfaPath, auth: false), '/login');
      expect(_redirect(kMfaPath), '/');
    });

    test('after verify, normal post-sign-in routing applies to /mfa', () {
      expect(_redirect(kMfaPath, mustSetPassword: true), kSetPasswordPath);
      expect(_redirect(kMfaPath, onboarded: false), kThemeOnboardingPath);
    });

    test('both MFA states map to the gate; a session does not', () {
      expect(
        redirectForAuthState(const AuthMfaPending(_challenge),
            path: '/login', onboardingCompleted: true),
        kMfaPath,
      );
      expect(
        redirectForAuthState(const AuthMfaBackupCodes(_challenge, ['A']),
            path: '/', onboardingCompleted: true),
        kMfaPath,
      );
      expect(
        redirectForAuthState(const AuthAuthenticated(_user),
            path: kMfaPath, onboardingCompleted: true),
        '/',
      );
    });
  });

  group('mustSetPassword gate', () {
    test('every other route leads to /set-password — no way around it', () {
      for (final path in [
        '/',
        '/chat/abc',
        '/settings',
        '/settings/security',
        '/admin',
        '/legal',
        '/login',
        '/invite/tok_0123456789abcdefghij',
        '/theme-onboarding',
      ]) {
        expect(_redirect(path, mustSetPassword: true), kSetPasswordPath,
            reason: path);
      }
    });

    test('the gate comes before theme onboarding', () {
      expect(_redirect('/', mustSetPassword: true, onboarded: false),
          kSetPasswordPath);
      expect(
          _redirect(kSetPasswordPath, mustSetPassword: true, onboarded: false),
          isNull);
    });

    test('/set-password itself is allowed while the flag is set', () {
      expect(_redirect(kSetPasswordPath, mustSetPassword: true), isNull);
    });

    test('once the flag clears, /set-password is left for home', () {
      expect(_redirect(kSetPasswordPath), '/');
    });

    test('once the flag clears, a first run continues to theme onboarding',
        () {
      expect(_redirect(kSetPasswordPath, onboarded: false),
          kThemeOnboardingPath);
    });

    test('signed out, /set-password is not reachable', () {
      expect(_redirect(kSetPasswordPath, auth: false), '/login');
    });
  });

  group('existing rules are unchanged', () {
    test('signed out: only public routes', () {
      expect(_redirect('/', auth: false), '/login');
      expect(_redirect('/settings', auth: false), '/login');
      expect(_redirect('/login', auth: false), isNull);
      expect(_redirect('/legal', auth: false), isNull);
      expect(_redirect('/invite/tok_0123456789abcdefghij', auth: false),
          isNull);
    });

    test('signed in: guest-only routes bounce home, /legal stays open', () {
      expect(_redirect('/login'), '/');
      expect(_redirect('/invite/tok_0123456789abcdefghij'), '/');
      expect(_redirect('/legal'), isNull);
      expect(_redirect('/settings'), isNull);
    });

    test('theme onboarding until completed', () {
      expect(_redirect('/', onboarded: false), kThemeOnboardingPath);
      expect(_redirect(kThemeOnboardingPath, onboarded: false), isNull);
      expect(_redirect(kThemeOnboardingPath), '/');
    });
  });
}
