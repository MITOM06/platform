import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';
import 'package:platform_client/features/meetings/domain/meeting_errors.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';

Meeting m(MeetingStatus status) => Meeting(
    id: 'm1',
    code: 'abc-defg-hjk',
    host: const MeetingPerson(userId: 'h'),
    coHosts: const [],
    invitees: const [],
    status: status,
    settings: MeetingSettings.defaults,
    attendance: const [],
    removedIds: const [],
    viewerRole: MeetingViewerRole.guest,
    createdAt: DateTime.utc(2026));
RoomPhase? to(PhaseChange? c) => c is PhaseTo ? c.phase : null;

void main() {
  test('starts on the pre-join screen, or goes to the details of an ended meeting', () {
    expect(initialPhase(null, null), RoomPhase.loading);
    expect(initialPhase(m(MeetingStatus.live), null), RoomPhase.prejoin);
    expect(initialPhase(m(MeetingStatus.scheduled), null), RoomPhase.prejoin);
    expect(initialPhase(m(MeetingStatus.ended), null), RoomPhase.ended);
    expect(initialPhase(null, const MeetingErrorInfo(status: 404, code: 'MEETING_NOT_FOUND')),
        RoomPhase.notFound);
    expect(initialPhase(null, const MeetingErrorInfo(network: true)), RoomPhase.error);
  });

  test('follows the join response', () {
    expect(phaseAfterJoin(const MeetingWaiting()), RoomPhase.waiting);
    expect(
        phaseAfterJoin(
            const MeetingJoined(url: 'wss://x', token: 't', role: MeetingRoomRole.attendee)),
        RoomPhase.connecting);
  });

  const errors = <(MeetingErrorInfo, RoomPhase)>[
    (MeetingErrorInfo(status: 403, code: 'MEETING_REMOVED'), RoomPhase.removed),
    (MeetingErrorInfo(status: 403, code: 'MEETING_LOCKED'), RoomPhase.locked),
    (MeetingErrorInfo(status: 409, code: 'MEETING_ENDED'), RoomPhase.ended),
    (MeetingErrorInfo(status: 409, code: 'MEETING_FULL'), RoomPhase.full),
    (MeetingErrorInfo(status: 503, code: 'MEETINGS_UNAVAILABLE'), RoomPhase.unavailable),
    (MeetingErrorInfo(status: 503), RoomPhase.unavailable),
    (MeetingErrorInfo(status: 404, code: 'MEETING_NOT_FOUND'), RoomPhase.notFound),
    (MeetingErrorInfo(network: true), RoomPhase.error),
  ];
  for (final (info, phase) in errors) {
    test('join error ${info.code ?? info.status} → $phase',
        () => expect(phaseAfterJoinError(info), phase));
  }

  test('reacts to the waiting room answers only while waiting', () {
    expect(phaseAfterPersonalEvent(RoomPhase.waiting, const AdmittedEvent(meetingId: 'm1')),
        isA<PhaseRejoin>());
    expect(phaseAfterPersonalEvent(RoomPhase.inRoom, const AdmittedEvent(meetingId: 'm1')), isNull);
    expect(to(phaseAfterPersonalEvent(RoomPhase.waiting, const DeniedEvent(meetingId: 'm1'))),
        RoomPhase.denied);
    expect(phaseAfterPersonalEvent(RoomPhase.prejoin, const DeniedEvent(meetingId: 'm1')), isNull);
  });

  test('removal and the end win over any live phase, never over a terminal one', () {
    for (final p in [RoomPhase.joining, RoomPhase.waiting, RoomPhase.connecting, RoomPhase.inRoom]) {
      expect(to(phaseAfterPersonalEvent(p, const RemovedEvent(meetingId: 'm1'))), RoomPhase.removed);
    }
    expect(to(phaseAfterPersonalEvent(RoomPhase.prejoin, const EndedEvent(meetingId: 'm1'))),
        RoomPhase.ended);
    expect(to(phaseAfterPersonalEvent(RoomPhase.waiting, const CancelledEvent(meetingId: 'm1'))),
        RoomPhase.ended);
    expect(phaseAfterPersonalEvent(RoomPhase.removed, const EndedEvent(meetingId: 'm1')), isNull);
    expect(phaseAfterPersonalEvent(RoomPhase.inRoom, const MutedEvent(meetingId: 'm1')), isNull);
  });

  test('tells a dropped connection from a closed room', () {
    expect(phaseAfterRoomClosed(RtcEnd.failed), RoomClosedNext.connectionLost);
    expect(phaseAfterRoomClosed(RtcEnd.ended), RoomClosedNext.verify);
  });

  test('knows which screens offer a way back in', () {
    expect(isTerminal(RoomPhase.removed), isTrue);
    expect(isTerminal(RoomPhase.left), isFalse);
    expect(canRejoin(RoomPhase.left), isTrue);
    expect(canRejoin(RoomPhase.connectionLost), isTrue);
    expect(canRejoin(RoomPhase.removed), isFalse);
    expect(canRejoin(RoomPhase.denied), isFalse);
  });
}
