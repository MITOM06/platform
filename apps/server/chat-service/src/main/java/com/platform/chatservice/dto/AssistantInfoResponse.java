package com.platform.chatservice.dto;

/**
 * The current member's personal assistant, as surfaced to the client (`GET /api/assistant/me`).
 * Mirrors the web/mobile {@code AssistantInfo} shape.
 */
public record AssistantInfoResponse(String botUserId, String name, String avatarUrl) {}
