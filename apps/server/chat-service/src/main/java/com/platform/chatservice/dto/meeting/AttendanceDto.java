package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/** One session of one person in the room; {@code leftAt} absent = still in the room. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AttendanceDto(
    String userId, String displayName, String role, Instant joinedAt, Instant leftAt) {}
