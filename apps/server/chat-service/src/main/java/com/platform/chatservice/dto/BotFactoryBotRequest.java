package com.platform.chatservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Request body for Bot Factory {@code POST /api/bots} and {@code PATCH /api/bots/{id}}. Null fields
 * are omitted so they map to the {@code optional()} Zod fields on the Bot Factory side (an explicit
 * {@code null} would fail {@code z.string().optional()} validation).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record BotFactoryBotRequest(
    String name, String description, String systemPrompt, String defaultProviderId) {}
