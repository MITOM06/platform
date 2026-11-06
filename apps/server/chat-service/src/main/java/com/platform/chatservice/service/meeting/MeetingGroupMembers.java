package com.platform.chatservice.service.meeting;

import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.service.AiConstants;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Who goes into a meeting's group chat: host, co-hosts, invitees and everyone who attended, each
 * once, minus removed people and the AI bot. A department is never expanded.
 */
public final class MeetingGroupMembers {

  private MeetingGroupMembers() {}

  /** Host first, then co-hosts, invitees, attendees in order of appearance. */
  public static List<String> of(Meeting m) {
    Set<String> out = new LinkedHashSet<>();
    add(out, m.getHostId());
    addAll(out, m.getCoHostIds());
    addAll(out, m.getInviteeIds());
    if (m.getAttendance() != null) {
      for (Meeting.Attendance a : m.getAttendance()) {
        if (a != null) {
          add(out, a.getUserId());
        }
      }
    }
    if (m.getRemovedIds() != null) {
      out.removeAll(m.getRemovedIds());
    }
    out.remove(AiConstants.AI_BOT_USER_ID);
    return new ArrayList<>(out);
  }

  private static void addAll(Set<String> out, List<String> ids) {
    if (ids != null) {
      ids.forEach(id -> add(out, id));
    }
  }

  private static void add(Set<String> out, String id) {
    if (id != null && !id.isBlank()) {
      out.add(id);
    }
  }
}
