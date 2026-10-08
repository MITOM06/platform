package com.platform.chatservice.dto.meeting;

/**
 * {@code PUT /api/meetings/{id}/notes/*}. {@code version} is the version the client edited on top
 * of ({@code 0} for the first save); a {@code Long} so that a missing value is not read as 0.
 */
public record MeetingNoteRequest(String content, Long version) {}
