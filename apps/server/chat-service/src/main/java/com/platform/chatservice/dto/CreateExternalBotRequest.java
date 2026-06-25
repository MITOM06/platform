package com.platform.chatservice.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateExternalBotRequest(
    @NotBlank String ownerUserId,
    @NotBlank String factoryBotId,
    @NotBlank String name,
    String avatarUrl) {}
