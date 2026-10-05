import '../../../l10n/app_localizations.dart';
import 'call_rules.dart';

/// The message (if any) explaining why a call ended. [byPeer] = the other side
/// ended it. Endings the user chose themselves need no explanation. Mirrors
/// web `endNoticeKey` (`lib/webrtc/call-end-notice.ts`).
String? callEndNotice(
  AppLocalizations l10n,
  CallEndReason reason, {
  required bool byPeer,
  required String peerName,
}) {
  if (byPeer) {
    return switch (reason) {
      CallEndReason.declined => l10n.callDeclined(peerName),
      CallEndReason.busy => l10n.callBusy(peerName),
      CallEndReason.mediaError => l10n.callPeerMediaError(peerName),
      CallEndReason.failed => l10n.callConnectionLost,
      CallEndReason.hangup => l10n.callEnded,
      CallEndReason.noAnswer => null,
      CallEndReason.answeredElsewhere => null,
    };
  }
  return switch (reason) {
    CallEndReason.noAnswer => l10n.callNoAnswer,
    CallEndReason.failed => l10n.callConnectionLost,
    CallEndReason.mediaError => l10n.callMediaError,
    _ => null,
  };
}
