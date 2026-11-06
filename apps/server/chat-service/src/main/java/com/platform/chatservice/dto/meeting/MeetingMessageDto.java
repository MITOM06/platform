package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/**
 * One in-meeting chat line: text, a file ({@code attachment}, absent on text-only lines) or both.
 * Never a system message.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MeetingMessageDto(
    String id,
    PersonDto sender,
    String content,
    Instant createdAt,
    MeetingAttachmentDto attachment) {

  /** A text-only line. */
  public MeetingMessageDto(String id, PersonDto sender, String content, Instant createdAt) {
    this(id, sender, content, createdAt, null);
  }
}
