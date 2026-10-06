package com.platform.chatservice.service.rtc;

import java.time.Instant;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Routes a verified LiveKit webhook to the domain that owns the room. A handler failure is logged
 * and swallowed: LiveKit treats a non-2xx answer as a delivery failure, and the event has already
 * been accepted.
 */
@Slf4j
@Service
public class RtcWebhookDispatcher {

  private final List<RtcRoomEventHandler> handlers;

  @Autowired
  public RtcWebhookDispatcher(ObjectProvider<RtcRoomEventHandler> handlers) {
    this(handlers.orderedStream().toList());
  }

  RtcWebhookDispatcher(List<RtcRoomEventHandler> handlers) {
    this.handlers = List.copyOf(handlers);
  }

  public void dispatch(LiveKitWebhookEvent event) {
    if (event == null || event.event() == null || event.room() == null) {
      return;
    }
    String room = event.room().name();
    if (room == null) {
      return;
    }
    handlers.stream()
        .filter(h -> h.supports(room))
        .findFirst()
        .ifPresentOrElse(
            h -> route(h, room, event),
            () -> log.debug("LiveKit webhook for unowned room {} ignored", room));
  }

  private void route(RtcRoomEventHandler handler, String room, LiveKitWebhookEvent event) {
    try {
      switch (event.event()) {
        case LiveKitWebhookEvent.PARTICIPANT_JOINED -> {
          RtcParticipantEvent joined = participantEvent(room, event);
          if (joined != null) {
            handler.onParticipantJoined(joined);
          }
        }
        case LiveKitWebhookEvent.PARTICIPANT_LEFT -> {
          RtcParticipantEvent left = participantEvent(room, event);
          if (left != null) {
            handler.onParticipantLeft(left);
          }
        }
        case LiveKitWebhookEvent.ROOM_FINISHED -> handler.onRoomFinished(room);
        default -> {
          // track_published, egress_*, … are not used yet.
        }
      }
    } catch (RuntimeException e) {
      log.error("LiveKit webhook {} for room {} failed", event.event(), room, e);
    }
  }

  private static RtcParticipantEvent participantEvent(String room, LiveKitWebhookEvent event) {
    if (event.participant() == null || event.participant().identity() == null) {
      return null;
    }
    return new RtcParticipantEvent(
        room,
        event.participant().identity(),
        event.participant().sid(),
        event.id(),
        event.createdAt() == null ? null : Instant.ofEpochSecond(event.createdAt()));
  }
}
