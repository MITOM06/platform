package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.MeetingSettingsDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.bson.types.ObjectId;
import org.springframework.http.HttpStatus;

/**
 * Validation and normalization of meeting create/update input. Every violation is a 400 {@code
 * MEETING_INVALID} naming the offending {@code field} (plus {@code max} when a limit applies), so
 * clients can show a localized message next to the right input.
 */
final class MeetingRequests {

  static final int TITLE_MAX = 120;
  static final int DESCRIPTION_MAX = 2000;
  static final int INVITEES_MAX = 100;

  /** A scheduled start may lag "now" by this much (clock skew, a slow form). */
  static final Duration START_GRACE = Duration.ofMinutes(5);

  static final Duration MAX_DURATION = Duration.ofHours(24);

  private MeetingRequests() {}

  /** Trimmed title; blank ⇒ null (the client shows its own localized default). */
  static String title(String raw) {
    return trimmed(raw, "title", TITLE_MAX);
  }

  /** Trimmed description; blank ⇒ null. */
  static String description(String raw) {
    return trimmed(raw, "description", DESCRIPTION_MAX);
  }

  /** Nulls, duplicates and the host dropped, order kept; malformed ids or too many ⇒ 400. */
  static List<String> invitees(List<String> raw, String hostId) {
    if (raw == null) {
      return new ArrayList<>();
    }
    Set<String> out = new LinkedHashSet<>();
    for (String id : raw) {
      if (id == null || id.isBlank() || Objects.equals(id, hostId)) {
        continue;
      }
      if (!ObjectId.isValid(id)) {
        throw invalid("inviteeIds");
      }
      out.add(id);
    }
    if (out.size() > INVITEES_MAX) {
      throw invalid("inviteeIds", INVITEES_MAX);
    }
    return new ArrayList<>(out);
  }

  /**
   * No start = instant meeting (then no end either). A start may not lie more than {@link
   * #START_GRACE} in the past; the end must follow the start by at most {@link #MAX_DURATION}.
   */
  static void schedule(Instant start, Instant end, Instant now) {
    if (start != null && start.isBefore(now.minus(START_GRACE))) {
      throw invalid("scheduledStart");
    }
    end(start, end);
  }

  /** The end alone, against a start that is not changing. */
  static void end(Instant start, Instant end) {
    if (end == null) {
      return;
    }
    if (start == null || !end.isAfter(start) || end.isAfter(start.plus(MAX_DURATION))) {
      throw invalid("scheduledEnd");
    }
  }

  /** {@code base} with every non-null field of {@code patch} applied (a copy — base untouched). */
  static Meeting.Settings settings(MeetingSettingsDto patch, Meeting.Settings base) {
    Meeting.Settings from = base == null ? new Meeting.Settings() : base;
    Meeting.Settings out =
        new Meeting.Settings(
            from.isWaitingRoom(),
            from.isMuteOnEntry(),
            from.isAllowAttendeeScreenShare(),
            from.isAttendeesCanEditNotes(),
            from.isLocked());
    if (patch == null) {
      return out;
    }
    if (patch.waitingRoom() != null) {
      out.setWaitingRoom(patch.waitingRoom());
    }
    if (patch.muteOnEntry() != null) {
      out.setMuteOnEntry(patch.muteOnEntry());
    }
    if (patch.allowAttendeeScreenShare() != null) {
      out.setAllowAttendeeScreenShare(patch.allowAttendeeScreenShare());
    }
    if (patch.attendeesCanEditNotes() != null) {
      out.setAttendeesCanEditNotes(patch.attendeesCanEditNotes());
    }
    if (patch.locked() != null) {
      out.setLocked(patch.locked());
    }
    return out;
  }

  /**
   * The {@code $set} entries that turn {@code base} into {@code merged}: one {@code
   * settings.<field>} per changed switch, so a concurrent single-field host command (LOCK, waiting
   * room, screen share) on another switch is never reverted by a stale read. A meeting stored
   * without a settings sub-document gets the whole object (a dotted path would leave the other
   * switches unset).
   */
  static Map<String, Object> changedSettings(Meeting.Settings base, Meeting.Settings merged) {
    Map<String, Object> out = new LinkedHashMap<>();
    if (base == null) {
      out.put("settings", merged);
      return out;
    }
    putIfChanged(out, "waitingRoom", base.isWaitingRoom(), merged.isWaitingRoom());
    putIfChanged(out, "muteOnEntry", base.isMuteOnEntry(), merged.isMuteOnEntry());
    putIfChanged(
        out,
        "allowAttendeeScreenShare",
        base.isAllowAttendeeScreenShare(),
        merged.isAllowAttendeeScreenShare());
    putIfChanged(
        out,
        "attendeesCanEditNotes",
        base.isAttendeesCanEditNotes(),
        merged.isAttendeesCanEditNotes());
    putIfChanged(out, "locked", base.isLocked(), merged.isLocked());
    return out;
  }

  private static void putIfChanged(
      Map<String, Object> out, String field, boolean before, boolean after) {
    if (before != after) {
      out.put("settings." + field, after);
    }
  }

  /**
   * Inviting a whole department needs membership of it or {@code MANAGE_DEPARTMENTS} — the same
   * rule as department group chats ({@code ConversationService.requireDepartmentAccess}).
   */
  static void department(UserPrincipal caller, String departmentId) {
    if (departmentId == null || departmentId.isBlank()) {
      return;
    }
    if (caller.inDepartment(departmentId) || caller.hasPermission("MANAGE_DEPARTMENTS")) {
      return;
    }
    throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.MEETING_DEPARTMENT_FORBIDDEN);
  }

  static ApiException invalid(String field) {
    return new ApiException(
        HttpStatus.BAD_REQUEST, ErrorCodes.MEETING_INVALID, null, Map.of("field", field));
  }

  static ApiException invalid(String field, int max) {
    return new ApiException(
        HttpStatus.BAD_REQUEST,
        ErrorCodes.MEETING_INVALID,
        null,
        Map.of("field", field, "max", max));
  }

  private static String trimmed(String raw, String field, int max) {
    if (raw == null) {
      return null;
    }
    String value = raw.trim();
    if (value.isEmpty()) {
      return null;
    }
    if (value.length() > max) {
      throw invalid(field, max);
    }
    return value;
  }
}
