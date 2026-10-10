package com.platform.chatservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.platform.chatservice.model.AiSource;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * A message as returned by REST and broadcast on {@code /topic/conversation/{id}}. {@code
 * pendingActions} (F2) is only present on AI replies that asked for an in-chat confirmation;
 * omitted otherwise.
 */
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
    List<String> mentions,
    @JsonInclude(JsonInclude.Include.NON_EMPTY) List<PendingActionDto> pendingActions,
    // ai-service stream replyId of an AI reply (null otherwise) — exact placeholder swap.
    @JsonInclude(JsonInclude.Include.NON_NULL) String aiReplyId,
    // RAG / web citations of an AI reply, so its source chips survive a reload.
    @JsonInclude(JsonInclude.Include.NON_EMPTY) List<AiSource> sources) {

  /** Constructor without {@code sources} (every message but a cited AI reply). */
  public MessageResponse(
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
      List<String> mentions,
      List<PendingActionDto> pendingActions,
      String aiReplyId) {
    this(
        id,
        conversationId,
        senderId,
        content,
        type,
        readBy,
        createdAt,
        replyToId,
        replyPreview,
        reactions,
        recalled,
        editedAt,
        mentions,
        pendingActions,
        aiReplyId,
        null);
  }

  public MessageResponse(
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
      List<String> mentions,
      List<PendingActionDto> pendingActions) {
    this(
        id,
        conversationId,
        senderId,
        content,
        type,
        readBy,
        createdAt,
        replyToId,
        replyPreview,
        reactions,
        recalled,
        editedAt,
        mentions,
        pendingActions,
        null);
  }

  /** Constructor without {@code pendingActions} (every non-AI message). */
  public MessageResponse(
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
    this(
        id,
        conversationId,
        senderId,
        content,
        type,
        readBy,
        createdAt,
        replyToId,
        replyPreview,
        reactions,
        recalled,
        editedAt,
        mentions,
        null);
  }

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

  /**
   * One sensitive AI action awaiting confirmation. {@code status}: {@code pending | confirmed |
   * failed | cancelled}; clients treat {@code pending} past {@code expiresAt} as expired and only
   * offer Confirm / Cancel to {@code requesterId}.
   */
  public record PendingActionDto(
      String id,
      String toolName,
      String provider,
      Map<String, Object> summary,
      String status,
      Instant expiresAt,
      String requesterId) {}
}
