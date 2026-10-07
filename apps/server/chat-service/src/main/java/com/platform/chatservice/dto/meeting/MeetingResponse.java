package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

/**
 * The {@code Meeting} object of the REST contract. Which fields are filled depends on {@code
 * viewerRole} ({@code guest} sees the least, host/co-host the most); null fields are omitted.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MeetingResponse(
    String id,
    String code,
    String title,
    String description,
    PersonDto host,
    List<PersonDto> coHosts,
    List<PersonDto> invitees,
    String departmentId,
    Instant scheduledStart,
    Instant scheduledEnd,
    String status,
    MeetingSettingsDto settings,
    List<AttendanceDto> attendance,
    List<String> removedIds,
    String viewerRole,
    Instant createdAt,
    Instant startedAt,
    Instant endedAt,
    Instant cancelledAt) {}
