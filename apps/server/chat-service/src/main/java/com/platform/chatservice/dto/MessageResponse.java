package com.platform.chatservice.dto;

import java.time.Instant;
import java.util.List;

public record MessageResponse(
    String id,
    String conversationId,
    String senderId,
    String content,
    String type,
    List<String> readBy,
    Instant createdAt
) {}
