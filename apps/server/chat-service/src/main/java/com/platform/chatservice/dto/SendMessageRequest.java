package com.platform.chatservice.dto;

public record SendMessageRequest(String conversationId, String content, String type) {}
