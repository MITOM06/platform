package com.platform.chatservice.exception;

import com.platform.chatservice.dto.meeting.MeetingNoteDto;
import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * 409 {@code MEETING_NOTE_CONFLICT}: a note was saved on a stale {@code version}. Carries the
 * current note, returned as the top-level {@code latest} field so the client can show "a newer
 * version exists" without overwriting what the user is typing.
 */
@Getter
public class MeetingNoteConflictException extends ApiException {

  private final transient MeetingNoteDto latest;

  public MeetingNoteConflictException(MeetingNoteDto latest) {
    super(HttpStatus.CONFLICT, ErrorCodes.MEETING_NOTE_CONFLICT);
    this.latest = latest;
  }
}
