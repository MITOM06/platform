package com.platform.chatservice.dto;

/** Body for {@code PUT /api/messages/{id}} — new message content. */
public record EditMessageRequest(String content) {}
