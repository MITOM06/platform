package com.platform.chatservice.dto;

import jakarta.validation.constraints.Size;

public record SendMessageRequest(
    String conversationId,
    @Size(max = 10_000, message = "Message content must not exceed 10,000 characters")
        String content,
    String type,
    String replyToId) {
  /** Backward-compatible constructor for non-reply messages. */
  public SendMessageRequest(String conversationId, String content, String type) {
    this(conversationId, content, type, null);
  }
}
