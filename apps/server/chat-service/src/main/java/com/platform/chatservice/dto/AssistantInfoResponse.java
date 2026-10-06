package com.platform.chatservice.dto;

/**
 * The current member's personal assistant, as surfaced to the client (`GET /api/assistant/me`).
 * Mirrors the web/mobile {@code AssistantInfo} shape; {@code systemPrompt} (persona) and {@code
 * providerId} (model) are additive so the settings screen opens pre-filled. Either may be null when
 * Bot Factory cannot be reached for a legacy registration.
 */
public record AssistantInfoResponse(
    String botUserId, String name, String avatarUrl, String systemPrompt, String providerId) {

  public AssistantInfoResponse(String botUserId, String name, String avatarUrl) {
    this(botUserId, name, avatarUrl, null, null);
  }
}
