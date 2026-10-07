package com.platform.chatservice.service.meeting;

import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.service.CallBusyRegistry;
import com.platform.chatservice.service.rtc.RtcParticipantEvent;
import com.platform.chatservice.service.rtc.RtcRoomEventHandler;
import com.platform.chatservice.service.rtc.RtcRooms;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * LiveKit webhooks for meeting rooms ({@code meet_{id}}) — the source of truth for attendance and
 * room state. Picked up by {@code RtcWebhookDispatcher} like the calls handler.
 *
 * <p>A host leaving never ends the meeting: LiveKit closes the room after its departure timeout
 * (set when the room is created) and {@code room_finished} ends it then.
 */
@Service
@RequiredArgsConstructor
public class MeetingRtcHandler implements RtcRoomEventHandler {

  private final MeetingStore store;
  private final MeetingEvents events;
  private final CallBusyRegistry busy;
  private final MeetingCloser closer;
  private final MeetingPeople people;

  @Override
  public boolean supports(String room) {
    return room != null && room.startsWith(RtcRooms.MEETING_PREFIX);
  }

  @Override
  public void onParticipantJoined(RtcParticipantEvent e) {
    Optional<Meeting> open = openMeeting(e.room());
    String userId = e.identity();
    if (open.isEmpty() || userId == null || userId.isBlank()) {
      return;
    }
    Meeting m = open.get();
    Instant at = e.createdAt() != null ? e.createdAt() : Instant.now();
    if (m.getStatus() == MeetingStatus.SCHEDULED) {
      store.markLive(m.getId(), at);
    }
    store.recordJoin(
        m.getId(),
        Meeting.Attendance.builder()
            .userId(userId)
            .displayName(
                MeetingMapper.person(userId, people.profiles(List.of(userId))).displayName())
            .role(MeetingAccess.roleOf(m, userId))
            .sid(e.participantSid())
            .joinedAt(at)
            .build());
    busy.markBusy(userId, e.room());
    store.findById(m.getId()).ifPresent(events::roster);
  }

  @Override
  public void onParticipantLeft(RtcParticipantEvent e) {
    Optional<Meeting> open = openMeeting(e.room());
    String userId = e.identity();
    if (open.isEmpty() || userId == null || userId.isBlank()) {
      return;
    }
    String meetingId = open.get().getId();
    if (!store.recordLeave(meetingId, userId, e.participantSid(), Instant.now())) {
      // An older session of someone who rejoined elsewhere, or a repeated webhook.
      return;
    }
    busy.clear(userId, e.room());
    store.findById(meetingId).ifPresent(events::roster);
  }

  @Override
  public void onRoomFinished(String room) {
    String meetingId = RtcRooms.idOf(room, RtcRooms.MEETING_PREFIX);
    if (meetingId != null) {
      closer.close(meetingId);
    }
  }

  /** The meeting behind {@code room}, unless the room is malformed or the meeting is ENDED. */
  private Optional<Meeting> openMeeting(String room) {
    String meetingId = RtcRooms.idOf(room, RtcRooms.MEETING_PREFIX);
    if (meetingId == null) {
      return Optional.empty();
    }
    return store.findById(meetingId).filter(m -> m.getStatus() != MeetingStatus.ENDED);
  }
}
