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
    Instant createdAt,
    String replyToId,
    ReplyPreviewDto replyPreview,
    List<ReactionDto> reactions,
    boolean recalled
) {
    /** Backward-compatible constructor (pre reply/reactions/recall fields). */
    public MessageResponse(String id, String conversationId, String senderId, String content,
                           String type, List<String> readBy, Instant createdAt) {
        this(id, conversationId, senderId, content, type, readBy, createdAt,
             null, null, List.of(), false);
    }

    public record ReplyPreviewDto(String messageId, String senderId, String content) {}

    public record ReactionDto(String userId, String emoji) {}
}
