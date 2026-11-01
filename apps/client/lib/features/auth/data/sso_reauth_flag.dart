import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/providers/theme_provider.dart';

const kSsoReauthPrefKey = 'sso_reauth_next';

/// "Ask the IdP to authenticate again on the next SSO" — one device-wide flag.
///
/// Signing out of PON does not end the company IdP's own session (ending it
/// would sign the person out of every other company app), so its cookie
/// survives and "Sign in with SSO" would silently re-enter the previous
/// person's account. A user-initiated sign-out sets this flag; the SSO button
/// then adds `reauth=1` (auth-service sends `prompt=login`) until an SSO
/// sign-in succeeds.
///
/// In shared_preferences because it must survive closing the app. It holds no
/// secret, only "someone signed out here". Never throws: a storage failure must
/// not stop a sign-out, and just means a silent SSO, as it was before this flag
/// existed. Mirror: web `lib/auth/sso-reauth.ts`.
class SsoReauthFlag {
  SsoReauthFlag(this._prefs);

  final SharedPreferences Function() _prefs;

  bool get isDue {
    try {
      return _prefs().getBool(kSsoReauthPrefKey) ?? false;
    } catch (e) {
      debugPrint('[Auth] SSO re-auth flag unreadable: $e');
      return false;
    }
  }

  Future<void> mark() async {
    try {
      await _prefs().setBool(kSsoReauthPrefKey, true);
    } catch (e) {
      debugPrint('[Auth] SSO re-auth flag not saved: $e');
    }
  }

  Future<void> clear() async {
    try {
      await _prefs().remove(kSsoReauthPrefKey);
    } catch (e) {
      debugPrint('[Auth] SSO re-auth flag not cleared: $e');
    }
  }
}

final ssoReauthFlagProvider = Provider<SsoReauthFlag>(
  (ref) => SsoReauthFlag(() => ref.read(sharedPreferencesProvider)),
);
