package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/**
 * A raised hand in a meeting. {@code displayName} is absent when the user cannot be resolved —
 * clients show a generic label, never the id.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record HandDto(String userId, String displayName, Instant raisedAt) {}
