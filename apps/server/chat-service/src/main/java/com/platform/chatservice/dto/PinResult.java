package com.platform.chatservice.dto;

import java.util.List;

public record PinResult(String conversationId, List<String> pinnedMessages) {}
