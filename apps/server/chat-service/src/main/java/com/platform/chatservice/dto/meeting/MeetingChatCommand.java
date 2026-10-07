package com.platform.chatservice.dto.meeting;

/**
 * STOMP {@code /app/meet.chat}. {@code clientId} (optional, {@code [A-Za-z0-9_-]{1,64}}) is echoed
 * back in {@code meet.chat} / {@code meet.error} so the sender can match its optimistic line; it is
 * never stored.
 */
public record MeetingChatCommand(String meetingId, String content, String clientId) {}
