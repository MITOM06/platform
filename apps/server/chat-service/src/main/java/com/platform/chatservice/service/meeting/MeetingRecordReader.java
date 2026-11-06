package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.MeetingRecordView;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingMessage;
import com.platform.chatservice.model.MeetingNote;
import com.platform.chatservice.model.MeetingSummaryDoc;
import com.platform.chatservice.service.AiConstants;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/**
 * Reads a meeting's record on behalf of a user (ai-service). Enforces {@link
 * MeetingAccess#canReadRecords}; every refusal — no meeting, no permission, removed, blank user —
 * is the same empty result so a caller cannot tell the cases apart. No HTTP concerns here.
 */
@Service
@RequiredArgsConstructor
public class MeetingRecordReader {

  static final int MAX_RECORDS = 4000;
  static final int MAX_CHAT = 1000;
  static final String UNKNOWN = "Unknown";

  private final MeetingStore store;
  private final MeetingLobby lobby;
  private final MongoTemplate mongo;
  private final MeetingPeople people;
  private final MeetingRecordService records;
  private final MeetingSummaryStore summaries;

  public Optional<MeetingRecordView> read(String meetingId, String userId) {
    if (meetingId == null || meetingId.isBlank() || userId == null || userId.isBlank()) {
      return Optional.empty();
    }
    Optional<Meeting> found = store.findById(meetingId);
    if (found.isEmpty()) {
      return Optional.empty();
    }
    Meeting m = found.get();
    boolean admitted = lobby.isAdmitted(meetingId, userId);
    if (!MeetingAccess.canReadRecords(m, userId, people.departmentIdsOf(userId), admitted)) {
      return Optional.empty();
    }

    List<MeetingMessage> messages = newestChat(meetingId);
    Map<String, String> attendanceNames = attendanceNames(m);
    Set<String> ids = new LinkedHashSet<>();
    if (m.getHostId() != null) {
      ids.add(m.getHostId());
    }
    for (MeetingMessage msg : messages) {
      if (msg.getSenderId() != null) {
        ids.add(msg.getSenderId());
      }
    }
    Map<String, PersonDto> profiles = ids.isEmpty() ? Map.of() : people.profiles(ids);

    return Optional.of(
        new MeetingRecordView(
            new MeetingRecordView.Meeting(
                m.getId(),
                m.getTitle(),
                m.getCode(),
                m.getStartedAt(),
                m.getEndedAt(),
                nameOf(m.getHostId(), profiles, attendanceNames)),
            attendees(m),
            records.listNewest(meetingId, MAX_RECORDS).stream()
                .map(
                    r ->
                        new MeetingRecordView.Rec(
                            r.getKind() == null ? null : r.getKind().name(),
                            r.getDisplayName(),
                            r.getText(),
                            r.getTs(),
                            r.getFileName()))
                .toList(),
            messages.stream()
                .map(
                    c ->
                        new MeetingRecordView.Chat(
                            nameOf(c.getSenderId(), profiles, attendanceNames),
                            c.getContent(),
                            c.getCreatedAt(),
                            c.getAttachment() == null ? null : c.getAttachment().getName()))
                .toList(),
            sharedNote(meetingId),
            summaries.latest(meetingId).map(MeetingSummaryDoc::getSummary).orElse(null)));
  }

  private List<MeetingMessage> newestChat(String meetingId) {
    Query query =
        new Query(
                Criteria.where("meetingId")
                    .is(meetingId)
                    .and("senderId")
                    .ne(AiConstants.AI_BOT_USER_ID))
            .with(
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "_id")))
            .limit(MAX_CHAT);
    List<MeetingMessage> rows = new ArrayList<>(mongo.find(query, MeetingMessage.class));
    Collections.reverse(rows);
    return rows;
  }

  private String sharedNote(String meetingId) {
    MeetingNote note =
        mongo.findOne(
            new Query(Criteria.where("meetingId").is(meetingId).and("scope").is("SHARED")),
            MeetingNote.class);
    return note == null ? null : note.getContent();
  }

  /** Distinct by user, names only. */
  private static List<MeetingRecordView.Attendee> attendees(Meeting m) {
    List<MeetingRecordView.Attendee> out = new ArrayList<>();
    Set<String> seen = new LinkedHashSet<>();
    if (m.getAttendance() == null) {
      return out;
    }
    for (Meeting.Attendance a : m.getAttendance()) {
      if (a == null || AiConstants.AI_BOT_USER_ID.equals(a.getUserId())) {
        continue;
      }
      if (a.getUserId() != null && !seen.add(a.getUserId())) {
        continue;
      }
      out.add(
          new MeetingRecordView.Attendee(
              a.getDisplayName() == null || a.getDisplayName().isBlank()
                  ? UNKNOWN
                  : a.getDisplayName()));
    }
    return out;
  }

  private static Map<String, String> attendanceNames(Meeting m) {
    Map<String, String> out = new HashMap<>();
    if (m.getAttendance() != null) {
      for (Meeting.Attendance a : m.getAttendance()) {
        if (a != null
            && a.getUserId() != null
            && a.getDisplayName() != null
            && !a.getDisplayName().isBlank()) {
          out.putIfAbsent(a.getUserId(), a.getDisplayName());
        }
      }
    }
    return out;
  }

  /** Profile name, else the attendance name, else a generic label — never the id. */
  private static String nameOf(
      String userId, Map<String, PersonDto> profiles, Map<String, String> attendanceNames) {
    PersonDto p = userId == null ? null : profiles.get(userId);
    if (p != null && p.displayName() != null) {
      return p.displayName();
    }
    String fallback = userId == null ? null : attendanceNames.get(userId);
    return fallback != null ? fallback : UNKNOWN;
  }
}
