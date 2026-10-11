package com.platform.chatservice.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;

/**
 * Response from connector-service {@code POST /internal/bot/sessions}: the one-time plaintext MCP
 * {@code token}, the {@code mcpUrl} the bot should call and the token's {@code expiresAt}
 * (BOT_SESSION_TTL_DAYS after issue). The token is injected into the bot's MCP server as a Bearer
 * credential and is never persisted by chat-service; the expiry is, so the token can be re-issued
 * before it lapses ({@code AssistantTokenRenewal}).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record BotSessionResponse(String token, String mcpUrl, Instant expiresAt) {}
