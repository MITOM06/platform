package com.platform.chatservice.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AiPersonaRequest(
    @Size(max = 30, message = "Name must not exceed 30 characters") String name,
    String avatarUrl,
    @Pattern(
            regexp = "friendly|professional|concise|creative",
            message = "Tone must be one of: friendly, professional, concise, creative")
        String tone,
    @Size(max = 500, message = "System prompt prefix must not exceed 500 characters")
        String systemPromptPrefix) {}
