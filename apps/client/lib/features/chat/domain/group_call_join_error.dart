import '../../../core/rtc/rtc_session.dart';
import '../../../l10n/app_localizations.dart';
import 'call_failure.dart';

/// Why joining a group call failed, for the snackbar shown instead of the
/// call screen: the mic / camera refused, the server refusing the room (with
/// its reason), or any other failure — localized, never the raw error.
String groupCallJoinErrorText(AppLocalizations l10n, Object error) {
  if (error is MediaAccessException) return l10n.callMediaError;
  final failure = callFailureOf(error);
  // A refusal of the room; "never joined" names one person, not a group.
  if (failure != null && failure != CallFailure.peerNeverJoined) {
    return callFailureText(l10n, failure, peerName: '');
  }
  return l10n.groupCallJoinFailed;
}
