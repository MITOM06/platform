package com.platform.chatservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * One conversation-history entry in the {@code ai.requests} payload (TASK-10).
 *
 * <p>Text turns carry only {@code role} + {@code content} (serialized exactly as before — {@code
 * type}/{@code imageUrls} are null and omitted by Jackson when {@code @JsonInclude(NON_NULL)} is
 * active, or simply ignored by ai-service when present-but-null). An {@code image} turn
 * additionally sets {@code type = "image"} and {@code imageUrls} (relative {@code
 * /api/uploads/{id}} paths); ai-service resolves those into image content blocks. Backward
 * compatible.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiHistoryEntry(String role, String content, String type, List<String> imageUrls) {

  /** Convenience factory for a plain text turn (no image fields). */
  public static AiHistoryEntry text(String role, String content) {
    return new AiHistoryEntry(role, content, null, null);
  }

  /** Convenience factory for an image turn (caption may be empty). */
  public static AiHistoryEntry image(String role, String caption, List<String> imageUrls) {
    return new AiHistoryEntry(role, caption, "image", imageUrls);
  }
}
