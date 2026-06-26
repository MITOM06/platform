package com.platform.chatservice.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Subset of the Bot Factory bot object returned by {@code GET/POST/PATCH /api/bots}. Bot Factory
 * returns many more fields (telegram, memory, cache settings…); we only bind the ones PON needs.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record BotFactoryBotResponse(
    String id, String name, String systemPrompt, String defaultProviderId) {}
