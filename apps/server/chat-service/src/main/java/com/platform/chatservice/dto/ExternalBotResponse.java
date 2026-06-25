package com.platform.chatservice.dto;

public record ExternalBotResponse(
    String id,
    String botUserId,
    String factoryBotId,
    String ownerUserId,
    String name,
    String avatarUrl,
    boolean enabled) {}
