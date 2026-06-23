package com.platform.chatservice.dto;

import java.util.List;

public record AiRequestPayload(
    String conversationId,
    String userId,
    String displayName,
    String content,
    List<AiHistoryEntry> history,
    /** Owning department id of the conversation, or null for personal chats (P6). */
    String departmentId) {}
