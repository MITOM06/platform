package com.platform.chatservice.dto.meeting;

/**
 * STOMP {@code /app/meet.transcript}: one final speech-recognition result; {@code ts} is epoch ms.
 */
public record MeetingTranscriptCommand(String meetingId, String text, Long ts) {}
