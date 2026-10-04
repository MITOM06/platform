import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/call_end_notice.dart';
import 'package:platform_client/features/chat/domain/call_rules.dart';
import 'package:platform_client/l10n/app_localizations.dart';

void main() {
  group('CallEndReason', () {
    test('round-trips the wire values shared with web', () {
      expect(CallEndReason.values.map((r) => r.wire), [
        'hangup',
        'declined',
        'busy',
        'no_answer',
        'media_error',
        'failed',
      ]);
      for (final r in CallEndReason.values) {
        expect(CallEndReason.fromWire(r.wire), r);
      }
    });

    test('a missing or unknown reason (older client) is a hangup', () {
      expect(CallEndReason.fromWire(null), CallEndReason.hangup);
      expect(CallEndReason.fromWire('something-new'), CallEndReason.hangup);
    });
  });

  group('decideIncomingOffer', () {
    test('rings when idle', () {
      expect(decideIncomingOffer(from: 'a'), IncomingOfferAction.ring);
    });
    test('ignores a repeated offer from the same caller', () {
      expect(decideIncomingOffer(from: 'a', ringingFrom: 'a'),
          IncomingOfferAction.ignore);
      expect(decideIncomingOffer(from: 'a', inCallWith: 'a'),
          IncomingOfferAction.ignore);
    });
    test('replies busy to anyone else while ringing or in a call', () {
      expect(decideIncomingOffer(from: 'b', ringingFrom: 'a'),
          IncomingOfferAction.replyBusy);
      expect(decideIncomingOffer(from: 'b', inCallWith: 'a'),
          IncomingOfferAction.replyBusy);
    });
  });

  group('endTargetsCurrentCall', () {
    test('only the current peer can end the call', () {
      expect(endTargetsCurrentCall(from: 'a', peerId: 'a'), isTrue);
      expect(endTargetsCurrentCall(from: 'b', peerId: 'a'), isFalse);
      expect(endTargetsCurrentCall(from: 'a', peerId: null), isFalse);
    });
  });

  group('EarlyIceBuffer', () {
    test('keeps candidates from the ringing caller and hands them over once',
        () {
      final buf = EarlyIceBuffer()..expect('alice');
      expect(buf.add('alice', {'candidate': 'c1'}), isTrue);
      expect(buf.add('mallory', {'candidate': 'x'}), isFalse);
      expect(buf.add(null, {'candidate': 'y'}), isFalse);
      buf.add('alice', {'candidate': 'c2'});
      expect(buf.takeFor('alice').map((c) => c['candidate']), ['c1', 'c2']);
      expect(buf.takeFor('alice'), isEmpty);
    });

    test('drops everything when the call goes to someone else', () {
      final buf = EarlyIceBuffer()..expect('alice');
      buf.add('alice', {'candidate': 'c1'});
      expect(buf.takeFor('bob'), isEmpty);
      expect(buf.add('alice', {'candidate': 'c2'}), isFalse);
    });

    test('a new ring starts from an empty buffer', () {
      final buf = EarlyIceBuffer()..expect('alice');
      buf.add('alice', {'candidate': 'old'});
      buf.expect('alice');
      expect(buf.takeFor('alice'), isEmpty);
    });
  });

  group('callEndNotice', () {
    final l10n = lookupAppLocalizations(const Locale('en'));

    test('explains a hang-up caused by the peer', () {
      String? n(CallEndReason r) =>
          callEndNotice(l10n, r, byPeer: true, peerName: 'Bob');
      expect(n(CallEndReason.declined), 'Bob declined the call');
      expect(n(CallEndReason.busy), 'Bob is on another call');
      expect(n(CallEndReason.mediaError),
          "Bob couldn't turn on their microphone or camera");
      expect(n(CallEndReason.failed), l10n.callConnectionLost);
      expect(n(CallEndReason.hangup), l10n.callEnded);
      expect(n(CallEndReason.noAnswer), isNull);
    });

    test('only explains local endings the user did not choose', () {
      String? n(CallEndReason r) =>
          callEndNotice(l10n, r, byPeer: false, peerName: 'Bob');
      expect(n(CallEndReason.noAnswer), l10n.callNoAnswer);
      expect(n(CallEndReason.failed), l10n.callConnectionLost);
      expect(n(CallEndReason.mediaError), l10n.callMediaError);
      expect(n(CallEndReason.hangup), isNull);
      expect(n(CallEndReason.declined), isNull);
    });
  });
}
