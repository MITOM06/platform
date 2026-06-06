package com.platform.chatservice.dto;

public record TokenUsageDayResponse(
    String date,
    int inputTokens,
    int outputTokens,
    int requestCount,
    int totalTokens
) {}
