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
    String status,
    boolean isPublic,
    List<PinnedMessageDto> pinnedMessages
) {
    public record LastMessageDto(String content, String senderId, Instant createdAt) {}

    public record PinnedMessageDto(String id, String senderId, String content, Instant createdAt) {}

    /** Backward-compatible constructor without isPublic/pinnedMessages. */
    public ConversationResponse(
            String id, String type, String name, String avatarUrl,
            List<String> participants, List<String> admins, String createdBy,
            Integer autoDeleteSeconds, LastMessageDto lastMessage, Instant lastMessageAt,
            long unreadCount, Instant createdAt, String status) {
        this(id, type, name, avatarUrl, participants, admins, createdBy,
             autoDeleteSeconds, lastMessage, lastMessageAt, unreadCount, createdAt,
             status, false, List.of());
    }
}
