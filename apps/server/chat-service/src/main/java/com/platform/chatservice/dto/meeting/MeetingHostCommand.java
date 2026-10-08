package com.platform.chatservice.dto.meeting;

/**
 * STOMP {@code /app/meet.host}: a host / co-host command. {@code action} is a {@code
 * MeetingHostAction} name; {@code targetId} is required by the actions aimed at one person.
 */
public record MeetingHostCommand(String meetingId, String action, String targetId) {}
