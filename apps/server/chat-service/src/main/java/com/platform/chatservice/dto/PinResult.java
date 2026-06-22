package com.platform.chatservice.dto;

import java.util.List;

/**
 * Result of a pin/unpin operation. {@code systemMessage} is the persisted {@code type:"system"}
 * notice ("X pinned/unpinned a message") the controller broadcasts alongside the PINNED_MESSAGE
 * event; never null.
 */
public record PinResult(
    String conversationId, List<String> pinnedMessages, MessageResponse systemMessage) {}
