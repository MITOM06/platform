package com.platform.chatservice.dto;

import jakarta.validation.constraints.Size;

/** Body for {@code PUT /api/messages/{id}} — new message content. */
public record EditMessageRequest(
    @Size(max = 10_000, message = "Message content must not exceed 10,000 characters")
        String content) {}
