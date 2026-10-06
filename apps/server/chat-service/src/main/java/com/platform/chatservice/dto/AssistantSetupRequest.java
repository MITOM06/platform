package com.platform.chatservice.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Self-service "BotFather Zone" setup payload. {@code providerId} is the Bot Factory provider id
 * the member picked in the model step.
 *
 * <p>{@code systemPrompt} and {@code providerId} are required for the FIRST setup (400 {@code
 * ASSISTANT_SETUP_INCOMPLETE} otherwise). When the member already has an assistant, a blank or
 * absent value keeps the stored one — so a rename or a model change no longer has to resend (or
 * silently wipes) the persona.
 */
public record AssistantSetupRequest(
    @NotBlank String name, String systemPrompt, String providerId) {}
