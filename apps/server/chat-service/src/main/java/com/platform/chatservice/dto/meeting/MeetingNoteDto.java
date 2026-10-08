package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/**
 * A meeting note. {@code scope} is {@code shared | private}; a note nobody wrote yet is {@code
 * content ""}, {@code version 0} and no {@code updatedBy} / {@code updatedAt}. {@code content} is
 * Markdown, kept verbatim.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MeetingNoteDto(
    String scope, String content, long version, PersonDto updatedBy, Instant updatedAt) {}
