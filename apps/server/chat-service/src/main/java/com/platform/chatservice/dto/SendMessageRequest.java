package com.platform.chatservice.dto;

public record SendMessageRequest(String conversationId, String content, String type, String replyToId) {
    /** Backward-compatible constructor for non-reply messages. */
    public SendMessageRequest(String conversationId, String content, String type) {
        this(conversationId, content, type, null);
    }
}
