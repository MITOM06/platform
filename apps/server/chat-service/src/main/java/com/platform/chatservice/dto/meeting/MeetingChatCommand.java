package com.platform.chatservice.dto.meeting;

/**
 * STOMP {@code /app/meet.chat}. {@code clientId} (optional, {@code [A-Za-z0-9_-]{1,64}}) is echoed
 * back in {@code meet.chat} / {@code meet.error} so the sender can match its optimistic line. A
 * valid one is stored with the line and makes the send idempotent: re-sending the same {@code
 * clientId} stores nothing and re-echoes the stored line to the sender only.
 */
public record MeetingChatCommand(String meetingId, String content, String clientId) {}
