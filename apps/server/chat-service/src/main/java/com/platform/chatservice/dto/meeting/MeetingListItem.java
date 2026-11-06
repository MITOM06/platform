package com.platform.chatservice.dto.meeting;

import java.time.Instant;

/** One row of the meetings a user may read, as ai-service lists them. Never carries a user id. */
public record MeetingListItem(
    String id,
    String title,
    String code,
    Instant startedAt,
    Instant endedAt,
    String summaryState) {}
