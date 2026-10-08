package com.platform.chatservice.dto.meeting;

/** STOMP {@code /app/meet.hand}: raise or lower the caller's own hand. */
public record MeetingHandCommand(String meetingId, Boolean raised) {}
