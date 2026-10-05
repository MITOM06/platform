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
    boolean recalled,
    Instant editedAt,
    List<String> mentions) {
  /** Backward-compatible constructor (pre reply/reactions/recall fields). */
  public MessageResponse(
      String id,
      String conversationId,
      String senderId,
      String content,
      String type,
      List<String> readBy,
      Instant createdAt) {
    this(
        id,
        conversationId,
        senderId,
        content,
        type,
        readBy,
        createdAt,
        null,
        null,
        List.of(),
        false,
        null,
        List.of());
  }

  /** {@code recalled == true}: the quoted message was unsent and {@code content} is blank. */
  public record ReplyPreviewDto(
      String messageId, String senderId, String content, boolean recalled) {
    public ReplyPreviewDto(String messageId, String senderId, String content) {
      this(messageId, senderId, content, false);
    }
  }

  public record ReactionDto(String userId, String emoji) {}
}
