package com.platform.chatservice.service.rtc;

import java.time.Instant;

/**
 * One participant joining or leaving a LiveKit room. {@code participantSid} tells two sessions of
 * the same identity apart (a rejoin from another device kicks the old one, and its "left" may
 * arrive after the new "joined"); {@code eventId} lets a handler drop a replayed webhook; {@code
 * createdAt} (null when LiveKit omits it) orders events.
 */
public record RtcParticipantEvent(
    String room, String identity, String participantSid, String eventId, Instant createdAt) {}
