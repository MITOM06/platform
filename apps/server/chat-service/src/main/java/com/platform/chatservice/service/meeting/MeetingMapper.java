package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.AttendanceDto;
import com.platform.chatservice.dto.meeting.MeetingResponse;
import com.platform.chatservice.dto.meeting.MeetingSettingsDto;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.model.Meeting;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * {@link Meeting} ⇒ {@link MeetingResponse}, filtered by the caller's {@code viewerRole}: a guest
 * (someone with the link) sees what the join page needs, an invitee also sees the people and the
 * attendance, host / co-host also the removed list. Names come from one batched lookup; an unknown
 * user keeps a nameless entry — the id is never used as a name.
 */
@Component
@RequiredArgsConstructor
public class MeetingMapper {

  private final MeetingPeople people;

  public MeetingResponse toResponse(Meeting m, String viewerRole) {
    return toResponse(m, viewerRole, people.profiles(peopleShownTo(m, viewerRole)));
  }

  /**
   * A page of meetings with the names of everyone on it resolved in ONE lookup (not one per
   * meeting). {@code viewerRole} gives the caller's role in each meeting.
   */
  public List<MeetingResponse> toResponses(
      List<Meeting> meetings, Function<Meeting, String> viewerRole) {
    List<String> roles = meetings.stream().map(viewerRole).toList();
    Set<String> ids = new LinkedHashSet<>();
    for (int i = 0; i < meetings.size(); i++) {
      ids.addAll(peopleShownTo(meetings.get(i), roles.get(i)));
    }
    Map<String, PersonDto> profiles = ids.isEmpty() ? Map.of() : people.profiles(ids);
    List<MeetingResponse> out = new ArrayList<>(meetings.size());
    for (int i = 0; i < meetings.size(); i++) {
      out.add(toResponse(meetings.get(i), roles.get(i), profiles));
    }
    return out;
  }

  /** The people whose names a viewer in {@code viewerRole} sees: the host, plus all for members. */
  private static Set<String> peopleShownTo(Meeting m, String viewerRole) {
    Set<String> ids = new LinkedHashSet<>();
    if (m.getHostId() != null) {
      ids.add(m.getHostId());
    }
    if (!"guest".equals(viewerRole)) {
      addAll(ids, m.getCoHostIds());
      addAll(ids, m.getInviteeIds());
    }
    return ids;
  }

  private MeetingResponse toResponse(
      Meeting m, String viewerRole, Map<String, PersonDto> profiles) {
    boolean guest = "guest".equals(viewerRole);
    boolean manager = "host".equals(viewerRole) || "cohost".equals(viewerRole);

    return new MeetingResponse(
        m.getId(),
        m.getCode(),
        m.getTitle(),
        m.getDescription(),
        m.getHostId() == null ? null : person(m.getHostId(), profiles),
        guest ? null : persons(m.getCoHostIds(), profiles),
        guest ? null : persons(m.getInviteeIds(), profiles),
        guest ? null : m.getDepartmentId(),
        m.getScheduledStart(),
        m.getScheduledEnd(),
        m.getStatus() == null ? null : m.getStatus().name(),
        MeetingSettingsDto.of(m.getSettings()),
        guest ? null : attendance(m.getAttendance()),
        manager ? copy(m.getRemovedIds()) : null,
        viewerRole,
        m.getCreatedAt(),
        m.getStartedAt(),
        m.getEndedAt(),
        m.getCancelledAt());
  }

  /** The resolved profile, or a nameless entry for an unknown user. */
  public static PersonDto person(String userId, Map<String, PersonDto> profiles) {
    PersonDto known = profiles == null ? null : profiles.get(userId);
    return known != null ? known : new PersonDto(userId, null, null);
  }

  /**
   * Everyone a meeting-wide notice (reminder, cancellation) goes to: host, co-hosts, invitees and
   * department members, minus removed people — distinct, in that order.
   */
  public static List<String> recipients(Meeting m, List<String> departmentMembers) {
    Set<String> out = new LinkedHashSet<>();
    if (m.getHostId() != null) {
      out.add(m.getHostId());
    }
    addAll(out, m.getCoHostIds());
    addAll(out, m.getInviteeIds());
    addAll(out, departmentMembers);
    if (m.getRemovedIds() != null) {
      out.removeAll(m.getRemovedIds());
    }
    return new ArrayList<>(out);
  }

  private static List<PersonDto> persons(List<String> ids, Map<String, PersonDto> profiles) {
    List<PersonDto> out = new ArrayList<>();
    if (ids != null) {
      for (String id : ids) {
        if (id != null) {
          out.add(person(id, profiles));
        }
      }
    }
    return out;
  }

  private static List<AttendanceDto> attendance(List<Meeting.Attendance> rows) {
    List<AttendanceDto> out = new ArrayList<>();
    if (rows != null) {
      for (Meeting.Attendance a : rows) {
        if (a != null) {
          out.add(
              new AttendanceDto(
                  a.getUserId(), a.getDisplayName(), a.getRole(), a.getJoinedAt(), a.getLeftAt()));
        }
      }
    }
    return out;
  }

  private static List<String> copy(List<String> values) {
    return values == null ? new ArrayList<>() : new ArrayList<>(values);
  }

  private static void addAll(Set<String> into, Collection<String> values) {
    if (values != null) {
      for (String v : values) {
        if (v != null && !v.isBlank()) {
          into.add(v);
        }
      }
    }
  }
}
