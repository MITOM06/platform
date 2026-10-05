package com.platform.chatservice.service.rtc;

/**
 * LiveKit room names. The prefix tells the webhook which domain owns the room (spec D8), so a room
 * name is all it needs to route an event.
 */
public final class RtcRooms {

  public static final String CALL_PREFIX = "call_";
  public static final String MEETING_PREFIX = "meet_";

  private RtcRooms() {}

  public static String forCall(String callId) {
    return CALL_PREFIX + callId;
  }

  public static String forMeeting(String meetingId) {
    return MEETING_PREFIX + meetingId;
  }

  /** The id after {@code prefix}, or null when the room does not carry that prefix. */
  public static String idOf(String room, String prefix) {
    if (room == null || !room.startsWith(prefix) || room.length() == prefix.length()) {
      return null;
    }
    return room.substring(prefix.length());
  }
}
