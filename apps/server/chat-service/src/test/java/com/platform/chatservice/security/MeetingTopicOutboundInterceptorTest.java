package com.platform.chatservice.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.service.meeting.MeetingLobby;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.support.MessageBuilder;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class MeetingTopicOutboundInterceptorTest {

  private static final String TOPIC = "/topic/meeting/m1";

  @Mock private WsSessionRegistry wsSessionRegistry;
  @Mock private MeetingLobby lobby;
  @Mock private MessageChannel channel;
  @InjectMocks private MeetingTopicOutboundInterceptor interceptor;

  private static Message<byte[]> outbound(
      SimpMessageType type, String destination, String session) {
    SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create(type);
    accessor.setDestination(destination);
    accessor.setSessionId(session);
    accessor.setLeaveMutable(true);
    return MessageBuilder.createMessage("{}".getBytes(), accessor.getMessageHeaders());
  }

  private void session(String userId) {
    when(wsSessionRegistry.bindingOf("ws-1"))
        .thenReturn(new WsSessionRegistry.Binding(userId, "sid-1"));
  }

  @Test
  void aFrameToSomeoneStillInTheMeetingIsDelivered() {
    session("inv");
    when(lobby.isRemoved("m1", "inv")).thenReturn(false);
    Message<byte[]> frame = outbound(SimpMessageType.MESSAGE, TOPIC, "ws-1");

    assertThat(interceptor.preSend(frame, channel)).isSameAs(frame);
  }

  /** Removed mid-meeting: the subscription stays open but carries nothing any more. */
  @Test
  void aFrameToSomeoneWhoWasRemovedIsDropped() {
    session("kicked");
    when(lobby.isRemoved("m1", "kicked")).thenReturn(true);

    assertThat(interceptor.preSend(outbound(SimpMessageType.MESSAGE, TOPIC, "ws-1"), channel))
        .isNull();
  }

  @Test
  void aFrameForAnUnknownSessionIsDropped() {
    assertThat(interceptor.preSend(outbound(SimpMessageType.MESSAGE, TOPIC, "ws-?"), channel))
        .isNull();
  }

  @Test
  void otherDestinationsAndControlFramesSkipTheLookup() {
    Message<byte[]> conversation =
        outbound(SimpMessageType.MESSAGE, "/topic/conversation/c1", "ws-1");
    Message<byte[]> queue = outbound(SimpMessageType.MESSAGE, "/user/queue/meeting", "ws-1");
    Message<byte[]> heartbeat = outbound(SimpMessageType.HEARTBEAT, TOPIC, "ws-1");

    assertThat(interceptor.preSend(conversation, channel)).isSameAs(conversation);
    assertThat(interceptor.preSend(queue, channel)).isSameAs(queue);
    assertThat(interceptor.preSend(heartbeat, channel)).isSameAs(heartbeat);
    verifyNoInteractions(lobby, wsSessionRegistry);
  }

  @Test
  void aRedisBlipDeliversRatherThanSilencingTheWholeRoom() {
    session("inv");
    when(lobby.isRemoved("m1", "inv")).thenThrow(new RedisConnectionFailureException("down"));
    Message<byte[]> frame = outbound(SimpMessageType.MESSAGE, TOPIC, "ws-1");

    assertThat(interceptor.preSend(frame, channel)).isSameAs(frame);
  }
}
