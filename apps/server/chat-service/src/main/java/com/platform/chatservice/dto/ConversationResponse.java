package com.platform.chatservice.dto;

import java.time.Instant;
import java.util.List;

public record ConversationResponse(
    String id,
    List<String> participants,
    LastMessageDto lastMessage,
    Instant lastMessageAt,
    long unreadCount,
    Instant createdAt
) {
    public record LastMessageDto(String content, String senderId, Instant createdAt) {}
}
