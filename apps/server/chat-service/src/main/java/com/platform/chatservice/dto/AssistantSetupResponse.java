package com.platform.chatservice.dto;

/** Result of provisioning a member's personal assistant. */
public record AssistantSetupResponse(String botUserId, String name) {}
