package com.platform.chatservice.service.rtc;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class RtcWebhookDispatcherTest {

  /** Records what it receives; claims every room with its prefix. */
  static class Recording implements RtcRoomEventHandler {
    final String prefix;
    final List<String> calls = new ArrayList<>();
    boolean explode;

    Recording(String prefix) {
      this.prefix = prefix;
    }

    @Override
    public boolean supports(String room) {
      return room.startsWith(prefix);
    }

    @Override
    public void onParticipantJoined(String room, String identity) {
      if (explode) {
        throw new IllegalStateException("boom");
      }
      calls.add("joined " + room + " " + identity);
    }

    @Override
    public void onParticipantLeft(String room, String identity) {
      calls.add("left " + room + " " + identity);
    }

    @Override
    public void onRoomFinished(String room) {
      calls.add("finished " + room);
    }
  }

  private static LiveKitWebhookEvent event(String type, String room, String identity) {
    return new LiveKitWebhookEvent(
        "evt-1",
        type,
        new LiveKitWebhookEvent.Room(room, "RM_1"),
        identity == null ? null : new LiveKitWebhookEvent.Participant(identity, "A", "PA_1"));
  }

  @Test
  void routesEachEventToTheHandlerThatOwnsTheRoom() {
    Recording calls = new Recording(RtcRooms.CALL_PREFIX);
    Recording meetings = new Recording(RtcRooms.MEETING_PREFIX);
    RtcWebhookDispatcher dispatcher = new RtcWebhookDispatcher(List.of(calls, meetings));

    dispatcher.dispatch(event(LiveKitWebhookEvent.PARTICIPANT_JOINED, "call_c1", "u1"));
    dispatcher.dispatch(event(LiveKitWebhookEvent.PARTICIPANT_LEFT, "meet_m1", "u2"));
    dispatcher.dispatch(event(LiveKitWebhookEvent.ROOM_FINISHED, "meet_m1", null));

    assertThat(calls.calls).containsExactly("joined call_c1 u1");
    assertThat(meetings.calls).containsExactly("left meet_m1 u2", "finished meet_m1");
  }

  @Test
  void ignoresUnknownRoomsEventsAndIncompletePayloads() {
    Recording calls = new Recording(RtcRooms.CALL_PREFIX);
    RtcWebhookDispatcher dispatcher = new RtcWebhookDispatcher(List.of(calls));

    dispatcher.dispatch(event(LiveKitWebhookEvent.PARTICIPANT_JOINED, "other_x", "u1"));
    dispatcher.dispatch(event("track_published", "call_c1", "u1"));
    dispatcher.dispatch(event(LiveKitWebhookEvent.PARTICIPANT_JOINED, "call_c1", null));
    dispatcher.dispatch(
        new LiveKitWebhookEvent("e", LiveKitWebhookEvent.ROOM_FINISHED, null, null));
    dispatcher.dispatch(null);

    assertThat(calls.calls).isEmpty();
  }

  @Test
  void handlerFailureIsContained() {
    Recording calls = new Recording(RtcRooms.CALL_PREFIX);
    calls.explode = true;
    RtcWebhookDispatcher dispatcher = new RtcWebhookDispatcher(List.of(calls));

    dispatcher.dispatch(event(LiveKitWebhookEvent.PARTICIPANT_JOINED, "call_c1", "u1"));

    assertThat(calls.calls).isEmpty(); // no exception escaped
  }
}
