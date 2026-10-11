import 'package:firebase_auth/firebase_auth.dart';

import '../../../core/utils/app_error.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/utils/auth_error.dart';

/// Localized message for a failed phone verification after the SMS code was
/// entered: Firebase refusing the code, or our server refusing the verified
/// number (`POST /api/users/me/phone/verify`). A number already on
/// another account says so — it used to read "wrong code".
String phoneVerifyErrorText(AppLocalizations l10n, Object error) {
  if (error is FirebaseAuthException) {
    return error.code == 'invalid-verification-code'
        ? l10n.phoneOtpInvalid
        : l10n.phoneOtpExpired;
  }
  if (authErrorCode(error) == 'PHONE_ALREADY_TAKEN') {
    return l10n.phoneAlreadyTaken;
  }
  if (isNetworkError(error)) return l10n.errNetwork;
  return l10n.phoneOtpInvalid;
}
