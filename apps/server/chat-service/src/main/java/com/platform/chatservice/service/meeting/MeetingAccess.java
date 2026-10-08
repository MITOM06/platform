package com.platform.chatservice.service.meeting;

import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

/**
 * Who may do what in a {@link Meeting} — pure functions, no Spring, no I/O. Callers read anything
 * that lives elsewhere (the department claim, the Redis "admitted" set) and pass it in.
 */
public final class MeetingAccess {

  /** Outcome of someone asking to enter the room. */
  public enum Decision {
    HOST,
    COHOST,
    INVITED,
    MUST_WAIT,
    DENIED_REMOVED,
    DENIED_LOCKED,
    DENIED_ENDED;

    /** Whether this person gets a LiveKit token straight away. */
    public boolean entersRoom() {
      return this == HOST || this == COHOST || this == INVITED;
    }
  }

  private MeetingAccess() {}

  /**
   * The access table, in order: ended ⇒ nobody; removed ⇒ never; host / co-host ⇒ always; invited,
   * department member or already admitted ⇒ straight in (even when locked); locked ⇒ refused;
   * waiting room on ⇒ wait; otherwise walk in.
   */
  public static Decision decide(
      Meeting m, String userId, Collection<String> departmentIds, boolean admitted) {
    if (m.getStatus() == MeetingStatus.ENDED) {
      return Decision.DENIED_ENDED;
    }
    if (contains(m.getRemovedIds(), userId)) {
      return Decision.DENIED_REMOVED;
    }
    if (isHost(m, userId)) {
      return Decision.HOST;
    }
    if (isCoHost(m, userId)) {
      return Decision.COHOST;
    }
    if (admitted || isInvited(m, userId, departmentIds)) {
      return Decision.INVITED;
    }
    Meeting.Settings settings = m.getSettings();
    if (settings != null && settings.isLocked()) {
      return Decision.DENIED_LOCKED;
    }
    if (settings == null || settings.isWaitingRoom()) {
      return Decision.MUST_WAIT;
    }
    return Decision.INVITED;
  }

  /** Host or co-host. */
  public static boolean canManage(Meeting m, String userId) {
    return isHost(m, userId) || isCoHost(m, userId);
  }

  /** Invited by name, or a member of the meeting's department. */
  public static boolean isInvited(Meeting m, String userId, Collection<String> departmentIds) {
    if (contains(m.getInviteeIds(), userId)) {
      return true;
    }
    return m.getDepartmentId() != null && contains(departmentIds, m.getDepartmentId());
  }

  /** Role in the room: {@code host | cohost | attendee}. */
  public static String roleOf(Meeting m, String userId) {
    if (isHost(m, userId)) {
      return "host";
    }
    return isCoHost(m, userId) ? "cohost" : "attendee";
  }

  /**
   * Role of the API caller towards this meeting: {@code host | cohost | invited | guest}. Anyone
   * who has an attendance row counts as invited.
   */
  public static String viewerRole(Meeting m, String userId, Collection<String> departmentIds) {
    if (isHost(m, userId)) {
      return "host";
    }
    if (isCoHost(m, userId)) {
      return "cohost";
    }
    if (isInvited(m, userId, departmentIds) || attended(m, userId)) {
      return "invited";
    }
    return "guest";
  }

  /** Currently in the room: has an attendance row that is still open ({@code leftAt == null}). */
  public static boolean isInside(Meeting m, String userId) {
    List<Meeting.Attendance> rows = m.getAttendance();
    return userId != null
        && rows != null
        && rows.stream()
            .anyMatch(a -> a != null && a.getLeftAt() == null && userId.equals(a.getUserId()));
  }

  /**
   * May read the meeting's records (chat history, shared note, own private note) — also after it
   * ended: anyone who belonged to it (host, co-host, invited / department, attended, admitted)
   * unless they were removed.
   */
  public static boolean canReadRecords(
      Meeting m, String userId, Collection<String> departmentIds, boolean admitted) {
    if (userId == null || contains(m.getRemovedIds(), userId)) {
      return false;
    }
    return canManage(m, userId)
        || isInvited(m, userId, departmentIds)
        || attended(m, userId)
        || admitted;
  }

  /**
   * May edit the shared note: host / co-host always, everyone else who can read the records only
   * while {@code settings.attendeesCanEditNotes} is on.
   */
  public static boolean canEditSharedNote(
      Meeting m, String userId, Collection<String> departmentIds, boolean admitted) {
    if (!canReadRecords(m, userId, departmentIds, admitted)) {
      return false;
    }
    Meeting.Settings settings = m.getSettings();
    return canManage(m, userId) || (settings != null && settings.isAttendeesCanEditNotes());
  }

  /**
   * Whether {@code actorId} may act on {@code targetId} (remove them): the host outranks everyone
   * else, a co-host only attendees; nobody outranks themselves.
   */
  public static boolean outranks(Meeting m, String actorId, String targetId) {
    if (actorId == null || Objects.equals(actorId, targetId)) {
      return false;
    }
    if (isHost(m, actorId)) {
      return true;
    }
    return isCoHost(m, actorId) && !canManage(m, targetId);
  }

  private static boolean isHost(Meeting m, String userId) {
    return userId != null && Objects.equals(m.getHostId(), userId);
  }

  private static boolean isCoHost(Meeting m, String userId) {
    return contains(m.getCoHostIds(), userId);
  }

  private static boolean attended(Meeting m, String userId) {
    List<Meeting.Attendance> rows = m.getAttendance();
    return userId != null
        && rows != null
        && rows.stream().anyMatch(a -> a != null && Objects.equals(a.getUserId(), userId));
  }

  private static boolean contains(Collection<String> values, String value) {
    return value != null && values != null && values.contains(value);
  }
}
