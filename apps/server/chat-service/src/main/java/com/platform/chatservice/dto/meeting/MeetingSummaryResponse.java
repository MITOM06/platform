package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.Map;

/**
 * {@code GET /api/meetings/{id}/summary}. {@code state} is the meeting's summary state ({@code
 * null} = AI was never on); {@code summary} is the newest stored {@code MeetingSummary}; {@code
 * groupConversationId} only when the caller is in that group ({@code inGroup}).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MeetingSummaryResponse(
    @JsonInclude(JsonInclude.Include.ALWAYS) String state,
    Map<String, Object> summary,
    Instant createdAt,
    String groupConversationId,
    boolean inGroup) {}
