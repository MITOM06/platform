package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * A person shown next to a meeting. {@code displayName} / {@code avatarUrl} are absent when the
 * user cannot be resolved — clients show a generic label, never the id.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PersonDto(String userId, String displayName, String avatarUrl) {}
