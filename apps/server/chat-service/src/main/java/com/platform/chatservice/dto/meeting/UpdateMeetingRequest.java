package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

/**
 * {@code PATCH /api/meetings/{id}} — every field optional, absent = unchanged; {@code inviteeIds}
 * replaces the list; {@code settings} merges field by field; {@code description: ""} clears it.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record UpdateMeetingRequest(
    String title,
    String description,
    List<String> inviteeIds,
    String departmentId,
    Instant scheduledStart,
    Instant scheduledEnd,
    MeetingSettingsDto settings) {}
