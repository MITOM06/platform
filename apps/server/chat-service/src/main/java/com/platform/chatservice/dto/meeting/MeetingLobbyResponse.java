package com.platform.chatservice.dto.meeting;

import java.util.List;

/**
 * {@code GET /api/meetings/{id}/lobby}: everyone waiting, same items and order as {@code
 * meet.lobby} (by name, nameless last); {@code []} when nobody waits.
 */
public record MeetingLobbyResponse(List<LobbyEntryDto> entries) {}
