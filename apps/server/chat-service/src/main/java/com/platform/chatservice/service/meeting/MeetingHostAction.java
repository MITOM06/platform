package com.platform.chatservice.service.meeting;

import java.util.Optional;

/** The host / co-host commands of {@code /app/meet.host}. */
public enum MeetingHostAction {
  MUTE_MIC(true),
  MUTE_ALL(false),
  REMOVE(true),
  LOWER_HAND(true),
  LOWER_ALL_HANDS(false),
  LOCK(false),
  UNLOCK(false),
  WAITING_ROOM_ON(false),
  WAITING_ROOM_OFF(false),
  ATTENDEE_SCREEN_SHARE_ON(false),
  ATTENDEE_SCREEN_SHARE_OFF(false),
  MAKE_COHOST(true),
  REVOKE_COHOST(true);

  private final boolean needsTarget;

  MeetingHostAction(boolean needsTarget) {
    this.needsTarget = needsTarget;
  }

  /** Whether the command is aimed at one person ({@code targetId} required). */
  public boolean needsTarget() {
    return needsTarget;
  }

  /** Exact (case-sensitive) name match; {@code null} or unknown ⇒ empty. Never throws. */
  public static Optional<MeetingHostAction> parse(String raw) {
    if (raw == null) {
      return Optional.empty();
    }
    for (MeetingHostAction a : values()) {
      if (a.name().equals(raw)) {
        return Optional.of(a);
      }
    }
    return Optional.empty();
  }
}
