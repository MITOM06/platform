package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.LobbyEntryDto;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.service.CallBusyRegistry;
import com.platform.chatservice.service.rtc.RtcRooms;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Ends a meeting exactly once — shared by {@code POST /end} and LiveKit's {@code room_finished}.
 * Closes the open attendance rows, frees everyone still inside from the call-busy registry, drops
 * the waiting room and tells the room and the people still waiting.
 */
@Component
@RequiredArgsConstructor
public class MeetingCloser {

  private final MeetingStore store;
  private final MeetingLobby lobby;
  private final MeetingEvents events;
  private final CallBusyRegistry busy;

  /** True when this call ended the meeting; false when it was already ENDED (idempotent). */
  public boolean close(String meetingId) {
    Optional<Meeting> before = store.markEnded(meetingId, Instant.now());
    if (before.isEmpty()) {
      return false;
    }
    List<String> waiting = lobby.waiting(meetingId).stream().map(LobbyEntryDto::userId).toList();
    lobby.clear(meetingId);
    String room = RtcRooms.forMeeting(meetingId);
    List<Meeting.Attendance> rows = before.get().getAttendance();
    if (rows != null) {
      for (Meeting.Attendance a : rows) {
        if (a != null && a.getLeftAt() == null && a.getUserId() != null) {
          busy.clear(a.getUserId(), room);
        }
      }
    }
    events.ended(meetingId, waiting);
    return true;
  }
}
