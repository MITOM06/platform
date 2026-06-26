package com.platform.chatservice.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * An AI provider entry from Bot Factory {@code GET /api/providers}. Exposes just the fields a
 * member needs to pick a model in the BotFather Zone setup wizard.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record BotFactoryProviderResponse(String id, String label, String provider, String model) {}
