package com.platform.chatservice.dto.meeting;

import java.time.Instant;
import java.util.List;

/**
 * A meeting's record as ai-service reads it. Carries NO user id anywhere: people appear only by
 * display name.
 */
public record MeetingRecordView(
    Meeting meeting,
    List<Attendee> attendees,
    List<Rec> records,
    List<Chat> chat,
    String sharedNote) {

  public record Meeting(
      String id, String title, String code, Instant startedAt, Instant endedAt, String hostName) {}

  public record Attendee(String displayName) {}

  public record Rec(String kind, String displayName, String text, Instant ts) {}

  public record Chat(String senderName, String content, Instant createdAt) {}
}
