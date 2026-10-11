import 'package:dio/dio.dart';

import '../../../core/rtc/rtc_session.dart';
import '../../../l10n/app_localizations.dart';

/// Why a LiveKit call could not go ahead — more specific than
/// `CallEndReason.failed`: the refusals of `POST /api/calls/{id}/token`
/// (`{error, code, statusCode}`, see docs/api-spec.md "Calls on LiveKit") and
/// an other side that never reached the room.
enum CallFailure {
  /// `CALLS_UNAVAILABLE` (503): LiveKit is not set up or not reachable.
  unavailable,

  /// `CALL_NOT_FOUND` (404).
  notFound,

  /// `CALL_ENDED` (409): over before we got in.
  ended,

  /// `CALL_NOT_SFU` (409): the call runs peer-to-peer, not on LiveKit.
  notSfu,

  /// `CALL_FORBIDDEN` (403): not a member, or blocked in a 1-on-1.
  forbidden,

  /// The other person answered (or rang) but never joined the room.
  peerNeverJoined,
}

/// The token request was refused for [failure]. Still a
/// [RoomConnectException], so callers that only know that keep working.
class CallRefusedException extends RoomConnectException {
  const CallRefusedException(this.failure);

  final CallFailure failure;
}

/// The [CallFailure] behind [error], or null when it says nothing specific
/// (a network failure, an unknown code).
CallFailure? callFailureOf(Object error) {
  if (error is CallRefusedException) return error.failure;
  if (error is! DioException) return null;
  final response = error.response;
  final data = response?.data;
  switch (data is Map ? data['code'] : null) {
    case 'CALLS_UNAVAILABLE':
      return CallFailure.unavailable;
    case 'CALL_NOT_FOUND':
      return CallFailure.notFound;
    case 'CALL_ENDED':
      return CallFailure.ended;
    case 'CALL_NOT_SFU':
      return CallFailure.notSfu;
    case 'CALL_FORBIDDEN':
      return CallFailure.forbidden;
  }
  // A 503 without a body (a proxy in front of chat-service): calls are down.
  return response?.statusCode == 503 ? CallFailure.unavailable : null;
}

/// Localized explanation of [failure]; [peerName] is the other person of a
/// 1-on-1 (a display name, never an id).
String callFailureText(
  AppLocalizations l10n,
  CallFailure failure, {
  required String peerName,
}) =>
    switch (failure) {
      CallFailure.unavailable => l10n.callErrUnavailable,
      CallFailure.notFound => l10n.callErrNotFound,
      CallFailure.ended => l10n.callErrEnded,
      CallFailure.notSfu => l10n.callErrNotSfu,
      CallFailure.forbidden => l10n.callErrForbidden,
      CallFailure.peerNeverJoined => l10n.callErrPeerNeverJoined(peerName),
    };
