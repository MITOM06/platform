/// Pure 1-on-1 call rules, shared by the signal handler and WebRTCService.
/// Mirrors web `lib/webrtc/call-manager.ts` / `call-end-notice.ts`.
library;

/// Why a call ended. Sent as `reason` on the `end` signal (relayed verbatim
/// by chat-service). A missing reason (older client) means [hangup].
enum CallEndReason {
  hangup('hangup'),
  declined('declined'),
  busy('busy'),
  noAnswer('no_answer'),
  mediaError('media_error'),
  failed('failed'),

  /// LiveKit calls: picked up on another of the user's devices.
  answeredElsewhere('answered_elsewhere');

  const CallEndReason(this.wire);
  final String wire;

  static CallEndReason fromWire(String? value) => CallEndReason.values
      .firstWhere((r) => r.wire == value, orElse: () => CallEndReason.hangup);
}

enum IncomingOfferAction { ring, ignore, replyBusy }

enum SfuRingAction { ring, ignore, replyBusy }

/// What to do with a LiveKit 1-on-1 ring [callId] while possibly already
/// ringing ([ringingCallId]), in a 1-on-1 ([inCall]) or a group call.
SfuRingAction decideSfuRing({
  required String callId,
  String? ringingCallId,
  bool inCall = false,
  bool inGroupCall = false,
}) {
  if (ringingCallId == callId) return SfuRingAction.ignore;
  if (ringingCallId != null || inCall || inGroupCall) return SfuRingAction.replyBusy;
  return SfuRingAction.ring;
}

/// What to do with an incoming offer from [from] while possibly already
/// ringing ([ringingFrom]), in a 1-on-1 call ([inCallWith]) or in a group
/// call ([inGroupCall]).
IncomingOfferAction decideIncomingOffer({
  required String from,
  String? ringingFrom,
  String? inCallWith,
  bool inGroupCall = false,
}) {
  if (ringingFrom == from || inCallWith == from) {
    return IncomingOfferAction.ignore;
  }
  if (ringingFrom != null || inCallWith != null || inGroupCall) {
    return IncomingOfferAction.replyBusy;
  }
  return IncomingOfferAction.ring;
}

/// After the callee rejects (declines, is busy, cannot open the mic), the
/// caller tells the callee's user that the call is over, so the callee's other
/// signed-in sessions (web + phone) stop ringing too.
bool endsCalleeSessions(CallEndReason reason) =>
    reason == CallEndReason.declined ||
    reason == CallEndReason.busy ||
    reason == CallEndReason.mediaError;

/// A stray/late `end` from anyone but the current peer must not end the call.
bool endTargetsCurrentCall({required String? from, required String? peerId}) =>
    from != null && peerId != null && from == peerId;

/// ICE candidates the caller trickles right after its offer, while we are
/// still ringing and have no peer connection. Dropping them made calls across
/// NATs connect without audio; they are applied once the call is answered.
class EarlyIceBuffer {
  String? _from;
  final List<Map<String, dynamic>> _items = [];

  /// A new ring from [from]: start an empty buffer for it.
  void expect(String from) {
    _from = from;
    _items.clear();
  }

  /// Keeps [candidate] if it comes from the caller being expected.
  bool add(String? from, Map<String, dynamic> candidate) {
    if (from == null || from != _from) return false;
    _items.add(candidate);
    return true;
  }

  /// Hands over the buffered candidates if the call is with [peerId], then
  /// resets. A call to anyone else gets nothing.
  List<Map<String, dynamic>> takeFor(String peerId) {
    final out = peerId == _from ? List.of(_items) : <Map<String, dynamic>>[];
    reset();
    return out;
  }

  void reset() {
    _from = null;
    _items.clear();
  }
}
