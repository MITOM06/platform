package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Someone in the waiting room; {@code displayName} absent when unknown (never the id). */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LobbyEntryDto(String userId, String displayName) {}
