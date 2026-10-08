package com.platform.chatservice.model;

/**
 * Lifecycle of a {@link Meeting}. A cancelled meeting is {@code ENDED} with {@code cancelledAt}.
 */
public enum MeetingStatus {
  SCHEDULED,
  LIVE,
  ENDED
}
