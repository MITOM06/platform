package com.platform.chatservice.dto;

import java.time.Instant;
import java.util.List;

public record AiMemoryResponse(
    String conversationId,
    String summary,
    List<String> keyFacts,
    Integer messageCount,
    Instant updatedAt) {}
