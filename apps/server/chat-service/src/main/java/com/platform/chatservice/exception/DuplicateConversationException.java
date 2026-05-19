package com.platform.chatservice.exception;

import lombok.Getter;

@Getter
public class DuplicateConversationException extends RuntimeException {

    private final String conversationId;

    public DuplicateConversationException(String conversationId) {
        super("Conversation already exists");
        this.conversationId = conversationId;
    }
}
