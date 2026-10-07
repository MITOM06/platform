package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.platform.chatservice.model.Meeting;

/**
 * Meeting settings. Boxed so a create/update request can send only the fields it changes; a
 * response always carries all five ({@link #of}).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MeetingSettingsDto(
    Boolean waitingRoom,
    Boolean muteOnEntry,
    Boolean allowAttendeeScreenShare,
    Boolean attendeesCanEditNotes,
    Boolean locked) {

  public static MeetingSettingsDto of(Meeting.Settings s) {
    Meeting.Settings settings = s == null ? new Meeting.Settings() : s;
    return new MeetingSettingsDto(
        settings.isWaitingRoom(),
        settings.isMuteOnEntry(),
        settings.isAllowAttendeeScreenShare(),
        settings.isAttendeesCanEditNotes(),
        settings.isLocked());
  }
}
