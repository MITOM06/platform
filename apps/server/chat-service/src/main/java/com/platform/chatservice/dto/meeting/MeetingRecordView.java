package com.platform.chatservice.dto.meeting;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * A meeting's record as ai-service reads it. Carries NO user id anywhere: people appear only by
 * display name. {@code summary} is the newest AI summary's map, or null (omitted from the JSON).
 */
public record MeetingRecordView(
    Meeting meeting,
    List<Attendee> attendees,
    List<Rec> records,
    List<Chat> chat,
    String sharedNote,
    Map<String, Object> summary) {

  public record Meeting(
      String id, String title, String code, Instant startedAt, Instant endedAt, String hostName) {}

  public record Attendee(String displayName) {}

  public record Rec(String kind, String displayName, String text, Instant ts, String fileName) {}

  public record Chat(String senderName, String content, Instant createdAt, String attachmentName) {}
}
