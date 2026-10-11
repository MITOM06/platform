package com.platform.chatservice.service;

import com.platform.chatservice.service.rtc.LiveKitRoomClient;
import com.platform.chatservice.service.rtc.RtcRooms;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Creates an sfu call's LiveKit room up front instead of letting the first join auto-create it with
 * LiveKit's defaults: those close a room ~20 s after its last participant drops, which ended a call
 * (as a plain "hangup") the 60 s reconnect grace was meant to save.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CallRoomProvisioner {

  /** The room may sit empty while the call rings ({@link CallService#RING_REAPER_DELAY}). */
  static final int EMPTY_TIMEOUT_S = 120;

  /** …and must outlive a dropped participant's reconnect grace ({@link SfuCallService}, 60 s). */
  static final int DEPARTURE_TIMEOUT_S = 90;

  static final int MAX_PARTICIPANTS = 25;

  private final LiveKitRoomClient rooms;

  public void createFor(String callId) {
    try {
      rooms.createRoom(
          RtcRooms.forCall(callId), EMPTY_TIMEOUT_S, DEPARTURE_TIMEOUT_S, MAX_PARTICIPANTS);
    } catch (RuntimeException e) {
      // LiveKit unreachable right now: the first join still creates the room (with defaults).
      log.warn("Could not create LiveKit room for call {}: {}", callId, e.toString());
    }
  }
}
