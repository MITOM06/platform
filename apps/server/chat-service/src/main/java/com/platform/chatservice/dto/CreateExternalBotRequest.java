package com.platform.chatservice.dto;

public record CreateExternalBotRequest(
    String ownerUserId, String factoryBotId, String name, String avatarUrl) {}
