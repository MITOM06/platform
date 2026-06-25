package com.platform.chatservice.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Self-service "BotFather Zone" setup payload. {@code providerId} is the Bot Factory provider id
 * the member picked in the model step.
 */
public record AssistantSetupRequest(
    @NotBlank String name, @NotBlank String systemPrompt, @NotBlank String providerId) {}
