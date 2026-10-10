package com.platform.chatservice.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * One citation of an AI reply: a knowledge-base document ({@code type} absent or {@code "kb"}) or a
 * web page ({@code type:"web"} with {@code url}). Stored on the AI message so the source chips
 * survive a reload; before, they only lived in the {@code AI_STREAM_DONE} event.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiSource(String documentId, String fileName, Double score, String url, String type) {

  /**
   * The {@code sources} of an ai-service {@code AI_STREAM_DONE}, keeping known fields only and
   * dropping entries without a {@code documentId}. Null when there are none (nothing stored).
   */
  public static List<AiSource> fromPayload(Object raw) {
    if (!(raw instanceof List<?> items)) return null;
    List<AiSource> out = new ArrayList<>();
    for (Object item : items) {
      if (!(item instanceof Map<?, ?> m)) continue;
      String id = text(m.get("documentId"));
      if (id == null) continue;
      Object score = m.get("score");
      out.add(
          new AiSource(
              id,
              text(m.get("fileName")),
              score instanceof Number n ? n.doubleValue() : null,
              text(m.get("url")),
              text(m.get("type"))));
    }
    return out.isEmpty() ? null : out;
  }

  private static String text(Object v) {
    return v instanceof String s && !s.isBlank() ? s : null;
  }
}
