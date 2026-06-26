package com.platform.chatservice.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Response from connector-service {@code POST /internal/bot/sessions}: the one-time plaintext MCP
 * {@code token} plus the {@code mcpUrl} the bot should call. The token is injected into the bot's
 * MCP server as a Bearer credential and is never persisted by chat-service.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record BotSessionResponse(String token, String mcpUrl) {}
