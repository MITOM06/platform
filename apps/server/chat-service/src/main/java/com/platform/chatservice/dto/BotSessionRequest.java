package com.platform.chatservice.dto;

/**
 * Body for connector-service {@code POST/DELETE /internal/bot/sessions}. {@code botUserId} is the
 * synthetic chat identity {@code "extbot:<factoryBotId>"} the MCP token is scoped to.
 */
public record BotSessionRequest(String userId, String botUserId) {}
