package com.platform.chatservice.service.meeting;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.config.LiveKitProperties;
import com.platform.chatservice.dto.meeting.MeetingJoinResponse;
import com.platform.chatservice.dto.meeting.MeetingLobbyResponse;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.rtc.LiveKitApiException;
import com.platform.chatservice.service.rtc.LiveKitRoomClient;
import com.platform.chatservice.service.rtc.LiveKitTokenService;
import com.platform.chatservice.service.rtc.LiveKitUnavailableException;
import com.platform.chatservice.service.rtc.RtcGrant;
import com.platform.chatservice.service.rtc.RtcRooms;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Getting into a meeting room: the LiveKit token or the waiting room, admit / deny, and ending the
 * meeting. Who may enter is decided by {@link MeetingAccess}; the lobby lives in Redis ({@link
 * MeetingLobby}) so every instance sees the same queue.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MeetingJoinService {

  /** Both LiveKit room timeouts: an empty room survives 5 minutes (host's network hiccup). */
  static final int ROOM_TIMEOUT_SECONDS = 300;

  static final int MAX_PARTICIPANTS = 25;

  private static final ObjectMapper JSON = new ObjectMapper();

  private final LiveKitProperties props;
  private final LiveKitTokenService tokens;
  private final LiveKitRoomClient rooms;
  private final MeetingStore store;
  private final MeetingLobby lobby;
  private final MeetingPeople people;
  private final MeetingEvents events;
  private final MeetingCloser closer;

  /**
   * Checked in this order so a client can tell an outage from a refusal: LiveKit off (503), unknown
   * meeting (404), then the {@link MeetingAccess} table.
   */
  public MeetingJoinResponse join(UserPrincipal caller, String meetingId) {
    if (!props.isConfigured()) {
      throw unavailable();
    }
    Meeting m = find(meetingId);
    String uid = caller.getUserId();
    MeetingAccess.Decision decision =
        MeetingAccess.decide(m, uid, caller.getDepts(), lobby.isAdmitted(meetingId, uid));
    switch (decision) {
      case DENIED_ENDED -> throw MeetingService.ended();
      case DENIED_REMOVED ->
          throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.MEETING_REMOVED);
      case DENIED_LOCKED -> throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.MEETING_LOCKED);
      case MUST_WAIT -> {
        return waitInLobby(m, uid);
      }
      default -> {
        return enter(m, uid, caller.getDepts());
      }
    }
  }

  /** The person closed the waiting page. Idempotent. */
  public void leaveLobby(String userId, String meetingId) {
    Meeting m = find(meetingId);
    if (lobby.remove(meetingId, userId)) {
      events.lobby(m, lobby.waiting(meetingId));
    }
  }

  /** Lets a waiting person in; a no-op when they are no longer waiting. */
  public void admit(String callerId, String meetingId, String userId) {
    Meeting m = managed(callerId, meetingId);
    if (!lobby.remove(meetingId, userId)) {
      return;
    }
    lobby.admit(meetingId, userId);
    events.admitted(meetingId, userId);
    events.lobby(m, lobby.waiting(meetingId));
  }

  /** Turns a waiting person away; a no-op when they are no longer waiting. */
  public void deny(String callerId, String meetingId, String userId) {
    Meeting m = managed(callerId, meetingId);
    if (!lobby.remove(meetingId, userId)) {
      return;
    }
    events.denied(meetingId, userId);
    events.lobby(m, lobby.waiting(meetingId));
  }

  /**
   * Who is waiting right now (host / co-host) — for a client that reconnects and may have missed a
   * {@code meet.lobby}. A read: never changes the lobby nor notifies anyone.
   */
  public MeetingLobbyResponse lobbySnapshot(String callerId, String meetingId) {
    managed(callerId, meetingId);
    return new MeetingLobbyResponse(lobby.waiting(meetingId));
  }

  /** Ends the meeting for everyone (host / co-host). Ending an ended meeting is a no-op. */
  public void end(String callerId, String meetingId) {
    Meeting m = find(meetingId);
    requireManager(m, callerId);
    if (m.getStatus() == MeetingStatus.ENDED) {
      return;
    }
    closer.close(meetingId);
    try {
      rooms.deleteRoom(RtcRooms.forMeeting(meetingId));
    } catch (RuntimeException e) {
      // The room may already be gone (closed itself, or LiveKit is down) — the meeting is ended.
      log.info("Meeting {} room could not be deleted: {}", meetingId, e.getMessage());
    }
  }

  private MeetingJoinResponse waitInLobby(Meeting m, String uid) {
    if (lobby.isWaiting(m.getId(), uid)) {
      return MeetingJoinResponse.waiting();
    }
    lobby.add(m.getId(), uid, profile(uid).displayName());
    events.lobby(m, lobby.waiting(m.getId()));
    return MeetingJoinResponse.waiting();
  }

  private MeetingJoinResponse enter(Meeting m, String uid, Collection<String> departmentIds) {
    String meetingId = m.getId();
    Set<String> inside = peopleInside(m);
    if (inside.size() >= MAX_PARTICIPANTS && !inside.contains(uid)) {
      throw new ApiException(HttpStatus.CONFLICT, ErrorCodes.MEETING_FULL);
    }
    if (lobby.remove(meetingId, uid)) {
      events.lobby(m, lobby.waiting(meetingId));
    }
    String room = RtcRooms.forMeeting(meetingId);
    try {
      rooms.createRoom(room, ROOM_TIMEOUT_SECONDS, ROOM_TIMEOUT_SECONDS, MAX_PARTICIPANTS);
    } catch (LiveKitApiException | LiveKitUnavailableException e) {
      log.warn("Meeting {} room could not be opened: {}", meetingId, e.getMessage());
      throw unavailable();
    }

    String role = MeetingAccess.roleOf(m, uid);
    boolean manager = !"attendee".equals(role);
    // Never roomAdmin, not even for the host: LiveKit accepts such a participant token as a
    // RoomService credential, so a co-host (or one removed / revoked since) could kick, mute or
    // re-permission people directly and bypass the host-control rules. Moderation goes through
    // /app/meet.host only.
    RtcGrant grant = RtcGrant.participant(room);
    if (!manager && m.getSettings() != null && !m.getSettings().isAllowAttendeeScreenShare()) {
      grant = grant.withSources(List.of(RtcGrant.CAMERA, RtcGrant.MICROPHONE));
    }
    PersonDto me = profile(uid);
    String token = tokens.participantToken(uid, me.displayName(), metadata(me.avatarUrl()), grant);
    if (manager) {
      events.lobbyTo(uid, meetingId, lobby.waiting(meetingId));
    } else if (!MeetingAccess.isInvited(m, uid, departmentIds)) {
      // Walked in (waiting room off) or was admitted: remember it, so turning the waiting room on
      // or locking the room later never shuts out someone who is already inside.
      lobby.admit(meetingId, uid);
    }
    return MeetingJoinResponse.joined(props.getUrl(), token, role);
  }

  private Meeting managed(String callerId, String meetingId) {
    Meeting m = find(meetingId);
    requireManager(m, callerId);
    if (m.getStatus() == MeetingStatus.ENDED) {
      throw MeetingService.ended();
    }
    return m;
  }

  private static void requireManager(Meeting m, String callerId) {
    if (!MeetingAccess.canManage(m, callerId)) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.MEETING_FORBIDDEN);
    }
  }

  private Meeting find(String meetingId) {
    if (meetingId == null || meetingId.isBlank()) {
      throw MeetingService.notFound();
    }
    return store.findById(meetingId).orElseThrow(MeetingService::notFound);
  }

  private PersonDto profile(String userId) {
    return MeetingMapper.person(userId, people.profiles(List.of(userId)));
  }

  /** Distinct people with an open attendance row. */
  private static Set<String> peopleInside(Meeting m) {
    Set<String> inside = new HashSet<>();
    if (m.getAttendance() != null) {
      for (Meeting.Attendance a : m.getAttendance()) {
        if (a != null && a.getUserId() != null && a.getLeftAt() == null) {
          inside.add(a.getUserId());
        }
      }
    }
    return inside;
  }

  /** Same participant metadata as calls ({@code SfuCallService}): {@code {"avatarUrl": …}}. */
  private static String metadata(String avatarUrl) {
    if (avatarUrl == null || avatarUrl.isBlank()) {
      return null;
    }
    try {
      return JSON.writeValueAsString(Map.of("avatarUrl", avatarUrl));
    } catch (JsonProcessingException e) {
      return null;
    }
  }

  private static ApiException unavailable() {
    return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCodes.MEETINGS_UNAVAILABLE);
  }
}
