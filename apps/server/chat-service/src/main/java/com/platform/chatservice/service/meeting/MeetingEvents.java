package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.AttendanceDto;
import com.platform.chatservice.dto.meeting.LobbyEntryDto;
import com.platform.chatservice.dto.meeting.MeetingEventDto;
import com.platform.chatservice.dto.meeting.MeetingSettingsDto;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.FcmService;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Publishes meeting events over STOMP (cluster-wide through {@link ClusterMessageBroker}) and FCM.
 *
 * <p>Room-wide events go to {@code /topic/meeting/{id}}; personal ones (lobby, admit/deny,
 * invitations, reminders) to {@code /user/queue/meeting}. Payloads never carry the LiveKit room
 * name. One recipient failing never stops delivery to the others.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MeetingEvents {

  public static final String TOPIC_PREFIX = "/topic/meeting/";
  public static final String USER_QUEUE = "/queue/meeting";

  static final String PUSH_INVITED = FcmService.MEETING_INVITED;
  static final String PUSH_STARTING = "MEETING_STARTING";

  private final ClusterMessageBroker broker;
  private final FcmService fcm;

  /** {@code meet.roster}: everyone still in the room, one row per person (latest open session). */
  public void roster(Meeting m) {
    Map<String, AttendanceDto> open = new LinkedHashMap<>();
    if (m.getAttendance() != null) {
      for (Meeting.Attendance a : m.getAttendance()) {
        if (a == null || a.getUserId() == null || a.getLeftAt() != null) {
          continue;
        }
        AttendanceDto row =
            new AttendanceDto(
                a.getUserId(), a.getDisplayName(), a.getRole(), a.getJoinedAt(), null);
        open.merge(a.getUserId(), row, MeetingEvents::later);
      }
    }
    toTopic(
        m.getId(),
        base("meet.roster", m.getId()).participants(new ArrayList<>(open.values())).build());
  }

  /** {@code meet.settings} after a PATCH changed them. */
  public void settings(Meeting m) {
    toTopic(
        m.getId(),
        base("meet.settings", m.getId()).settings(MeetingSettingsDto.of(m.getSettings())).build());
  }

  /** {@code meet.ended} to the room and to everyone still waiting in the lobby. */
  public void ended(String meetingId, Collection<String> lobbyUserIds) {
    toTopic(meetingId, base("meet.ended", meetingId).build());
    for (String userId : distinct(lobbyUserIds)) {
      toUser(userId, base("meet.ended", meetingId).build());
    }
  }

  /** {@code meet.lobby} to the host and every co-host. */
  public void lobby(Meeting m, List<LobbyEntryDto> waiting) {
    Set<String> managers = new LinkedHashSet<>();
    if (m.getHostId() != null) {
      managers.add(m.getHostId());
    }
    managers.addAll(distinct(m.getCoHostIds()));
    for (String userId : managers) {
      lobbyTo(userId, m.getId(), waiting);
    }
  }

  /** {@code meet.lobby} to one person — the host/co-host who just joined. */
  public void lobbyTo(String userId, String meetingId, List<LobbyEntryDto> waiting) {
    toUser(
        userId,
        base("meet.lobby", meetingId).waiting(waiting == null ? List.of() : waiting).build());
  }

  public void admitted(String meetingId, String userId) {
    toUser(userId, base("meet.admitted", meetingId).build());
  }

  public void denied(String meetingId, String userId) {
    toUser(userId, base("meet.denied", meetingId).build());
  }

  public void cancelled(String meetingId, Collection<String> userIds) {
    for (String userId : distinct(userIds)) {
      toUser(userId, base("meet.cancelled", meetingId).build());
    }
  }

  /** {@code meet.invited} + an FCM push for invitees who are offline. */
  public void invited(Meeting m, String hostName, Collection<String> userIds) {
    for (String userId : distinct(userIds)) {
      toUser(
          userId,
          base("meet.invited", m.getId())
              .code(m.getCode())
              .title(m.getTitle())
              .hostId(m.getHostId())
              .hostName(hostName)
              .scheduledStart(m.getScheduledStart())
              .build());
      push(userId, PUSH_INVITED, m, true);
    }
  }

  /** {@code meet.starting} + an FCM push whether or not the person is online. */
  public void starting(Meeting m, Collection<String> userIds) {
    for (String userId : distinct(userIds)) {
      toUser(
          userId,
          base("meet.starting", m.getId())
              .code(m.getCode())
              .title(m.getTitle())
              .scheduledStart(m.getScheduledStart())
              .build());
      push(userId, PUSH_STARTING, m, false);
    }
  }

  private void push(String userId, String type, Meeting m, boolean onlyWhenOffline) {
    try {
      fcm.sendMeetingPush(userId, type, m.getId(), m.getCode(), m.getTitle(), onlyWhenOffline);
    } catch (Exception e) {
      log.warn("Meeting push {} to one recipient failed: {}", type, e.getMessage());
    }
  }

  private void toTopic(String meetingId, MeetingEventDto event) {
    try {
      broker.convertAndSend(TOPIC_PREFIX + meetingId, event);
    } catch (Exception e) {
      log.warn("Meeting event {} could not be published: {}", event.getEvent(), e.getMessage());
    }
  }

  private void toUser(String userId, MeetingEventDto event) {
    try {
      broker.convertAndSendToUser(userId, USER_QUEUE, event);
    } catch (Exception e) {
      log.warn("Meeting event {} to one user failed: {}", event.getEvent(), e.getMessage());
    }
  }

  private static MeetingEventDto.MeetingEventDtoBuilder base(String event, String meetingId) {
    return MeetingEventDto.builder().event(event).meetingId(meetingId);
  }

  private static AttendanceDto later(AttendanceDto a, AttendanceDto b) {
    if (a.joinedAt() == null) {
      return b;
    }
    return b.joinedAt() != null && b.joinedAt().isAfter(a.joinedAt()) ? b : a;
  }

  private static Set<String> distinct(Collection<String> userIds) {
    Set<String> out = new LinkedHashSet<>();
    if (userIds != null) {
      for (String id : userIds) {
        if (id != null && !id.isBlank()) {
          out.add(id);
        }
      }
    }
    return out;
  }
}
