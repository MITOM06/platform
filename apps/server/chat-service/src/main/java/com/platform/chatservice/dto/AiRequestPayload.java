package com.platform.chatservice.dto;

import java.util.List;
import java.util.Map;

public record AiRequestPayload(
    String conversationId,
    String userId,
    String displayName,
    String content,
    List<Map<String, String>> history
) {}
