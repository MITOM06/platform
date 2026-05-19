package com.platform.chatservice.exception;

public class ConversationNotFoundException extends RuntimeException {
    public ConversationNotFoundException(String id) {
        super("Conversation not found: " + id);
    }
}
