package com.platform.chatservice.dto;

import java.util.List;
import java.util.Map;

public record AiRequestPayload(
    String conversationId,
    String userId,
    String displayName,
    String content,
    List<Map<String, String>> history,
    /** Owning department id of the conversation, or null for personal chats (P6). */
    String departmentId) {}
