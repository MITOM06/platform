package com.platform.chatservice.service.rtc;

/**
 * Implemented by each domain that owns LiveKit rooms (calls, meetings). The webhook is the source
 * of truth for who is in a room, so a crashed client can no longer leave a ghost participant.
 */
public interface RtcRoomEventHandler {

  /** True when this handler owns {@code room} (decided by the room-name prefix). */
  boolean supports(String room);

  void onParticipantJoined(String room, String identity);

  void onParticipantLeft(String room, String identity);

  void onRoomFinished(String room);
}
