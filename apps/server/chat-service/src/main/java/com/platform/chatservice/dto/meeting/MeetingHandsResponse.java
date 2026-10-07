package com.platform.chatservice.dto.meeting;

import java.util.List;

/** {@code GET /api/meetings/{id}/hands}: raised hands in raise order (earliest first). */
public record MeetingHandsResponse(List<HandDto> hands) {}
