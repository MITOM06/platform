package com.platform.chatservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * One conversation-history entry in the {@code ai.requests} payload (TASK-10).
 *
 * <p>Text turns carry {@code role} + {@code content}; an {@code image} turn additionally sets
 * {@code type = "image"} and {@code imageUrls} (relative {@code /api/uploads/{id}} paths) which
 * ai-service resolves into image content blocks. {@code senderId} + {@code senderName} attribute
 * the turn so the assistant knows who said what in a shared chat: the name is a display name (the
 * persona name for the built-in AI, the registry name for a Bot Factory assistant) and is omitted —
 * never replaced by the id — when it cannot be resolved (ai-service then uses a generic label; it
 * never shows ids to the model). Null fields are omitted; every field but role/content is optional.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiHistoryEntry(
    String role,
    String content,
    String type,
    List<String> imageUrls,
    String senderId,
    String senderName) {

  /** Convenience factory for a plain text turn (no image fields). */
  public static AiHistoryEntry text(String role, String content) {
    return new AiHistoryEntry(role, content, null, null, null, null);
  }

  /** Convenience factory for an image turn (caption may be empty). */
  public static AiHistoryEntry image(String role, String caption, List<String> imageUrls) {
    return new AiHistoryEntry(role, caption, "image", imageUrls, null, null);
  }

  /** This turn attributed to {@code senderId} / {@code senderName} (either may be null). */
  public AiHistoryEntry withSender(String senderId, String senderName) {
    return new AiHistoryEntry(role, content, type, imageUrls, senderId, senderName);
  }
}
