package com.platform.chatservice.service.rtc;

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
    String identity = event.participant() == null ? null : event.participant().identity();
    try {
      switch (event.event()) {
        case LiveKitWebhookEvent.PARTICIPANT_JOINED -> {
          if (identity != null) {
            handler.onParticipantJoined(room, identity);
          }
        }
        case LiveKitWebhookEvent.PARTICIPANT_LEFT -> {
          if (identity != null) {
            handler.onParticipantLeft(room, identity);
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
}
