package com.platform.chatservice.dto;

import java.time.Instant;

public record ReminderResponse(
    String id,
    String userId,
    String conversationId,
    String text,
    Instant remindAt,
    boolean done,
    Instant createdAt) {}
