package com.platform.chatservice.dto;

import java.util.List;

public record AiRequestPayload(
    String conversationId,
    String userId,
    String displayName,
    String content,
    List<AiHistoryEntry> history,
    /** Owning department id of the conversation, or null for personal chats (P6). */
    String departmentId,
    /** Caller role NAME from the JWT (P2a); null for legacy tokens. */
    String role,
    /** Caller capability keys from the JWT {@code perms} claim (P2a). */
    List<String> perms,
    /** Caller department ids from the JWT {@code depts} claim (P2a). */
    List<String> departmentIds) {}
