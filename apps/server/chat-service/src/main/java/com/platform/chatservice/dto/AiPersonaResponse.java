package com.platform.chatservice.dto;

import java.time.Instant;

public record AiPersonaResponse(
    String conversationId,
    String name,
    String avatarUrl,
    String tone,
    String systemPromptPrefix,
    String createdBy,
    Instant updatedAt
) {}
