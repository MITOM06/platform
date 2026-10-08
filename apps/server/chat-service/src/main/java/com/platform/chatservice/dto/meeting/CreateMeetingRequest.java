package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

/**
 * {@code POST /api/meetings}. Validation (limits, schedule window, department access) lives in the
 * service so every violation maps to {@code MEETING_INVALID} with {@code params.field}.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CreateMeetingRequest(
    String title,
    String description,
    List<String> inviteeIds,
    String departmentId,
    Instant scheduledStart,
    Instant scheduledEnd,
    MeetingSettingsDto settings) {}
