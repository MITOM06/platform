import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';
import 'package:platform_client/features/chat/domain/call_end_notice.dart';
import 'package:platform_client/features/chat/domain/call_failure.dart';
import 'package:platform_client/features/chat/domain/call_rules.dart';
import 'package:platform_client/features/chat/domain/group_call_join_error.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// Localized, specific texts for calls that could not go ahead (F8–F10):
/// never the raw code, never a generic "failed" when the reason is known.
void main() {
  final l10n = lookupAppLocalizations(const Locale('en'));

  test('each failure has its own message', () {
    final texts = {
      for (final f in CallFailure.values)
        f: callFailureText(l10n, f, peerName: 'Bob'),
    };
    expect(texts[CallFailure.unavailable], l10n.callErrUnavailable);
    expect(texts[CallFailure.notFound], l10n.callErrNotFound);
    expect(texts[CallFailure.ended], l10n.callErrEnded);
    expect(texts[CallFailure.notSfu], l10n.callErrNotSfu);
    expect(texts[CallFailure.forbidden], l10n.callErrForbidden);
    expect(texts[CallFailure.peerNeverJoined], l10n.callErrPeerNeverJoined('Bob'));
    expect(texts.values.toSet(), hasLength(CallFailure.values.length));
    for (final t in texts.values) {
      expect(t, isNot(contains('CALL')));
    }
  });

  test('the end notice of a failed call names the failure when known', () {
    expect(
      callEndNotice(l10n, CallEndReason.failed,
          byPeer: false, peerName: 'Bob', failure: CallFailure.forbidden),
      l10n.callErrForbidden,
    );
    expect(
      callEndNotice(l10n, CallEndReason.failed, byPeer: false, peerName: 'Bob'),
      l10n.callConnectionLost,
    );
  });

  group('a group call that could not be joined (F8)', () {
    test('mic / camera refused', () {
      expect(groupCallJoinErrorText(l10n, const MediaAccessException()),
          l10n.callMediaError);
    });

    test('a refused token says why', () {
      expect(
          groupCallJoinErrorText(
              l10n, const CallRefusedException(CallFailure.unavailable)),
          l10n.callErrUnavailable);
    });

    test('anything else is the localized join failure, never raw text', () {
      expect(groupCallJoinErrorText(l10n, const RoomConnectException()),
          l10n.groupCallJoinFailed);
      expect(groupCallJoinErrorText(l10n, Exception('boom')),
          l10n.groupCallJoinFailed);
    });
  });
}
