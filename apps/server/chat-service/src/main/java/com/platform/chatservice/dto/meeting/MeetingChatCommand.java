package com.platform.chatservice.dto.meeting;

/**
 * STOMP {@code /app/meet.chat}. {@code clientId} (optional, {@code [A-Za-z0-9_-]{1,64}}) is echoed
 * back in {@code meet.chat} / {@code meet.error} so the sender can match its optimistic line. A
 * valid one is stored with the line and makes the send idempotent: re-sending the same {@code
 * clientId} stores nothing and re-echoes the stored line to the sender only.
 *
 * <p>{@code attachment} (optional) is a file the sender uploaded; the server ignores its {@code
 * size} and {@code contentType} and reads them from the stored file. {@code content} may then be
 * empty.
 */
public record MeetingChatCommand(
    String meetingId, String content, String clientId, Attachment attachment) {

  /** A text-only command. */
  public MeetingChatCommand(String meetingId, String content, String clientId) {
    this(meetingId, content, clientId, null);
  }

  public record Attachment(String url, String name, Long size, String contentType) {}
}
