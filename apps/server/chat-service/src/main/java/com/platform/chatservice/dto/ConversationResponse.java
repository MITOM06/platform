package com.platform.chatservice.dto;

import java.time.Instant;
import java.util.List;

public record ConversationResponse(
    String id,
    String type,
    String name,
    String avatarUrl,
    List<String> participants,
    List<String> admins,
    String createdBy,
    Integer autoDeleteSeconds,
    LastMessageDto lastMessage,
    Instant lastMessageAt,
    long unreadCount,
    Instant createdAt,
    String status
) {
    public record LastMessageDto(String content, String senderId, Instant createdAt) {}
}
