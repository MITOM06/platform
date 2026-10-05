package com.platform.chatservice.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.service.ConversationMembershipCache;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.support.MessageBuilder;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class ConversationTopicOutboundInterceptorTest {

  private static final String CONV = "64b7f0c2a1b2c3d4e5f60718";

  @Mock private WsSessionRegistry wsSessionRegistry;
  @Mock private ConversationMembershipCache membershipCache;
  @Mock private MessageChannel channel;

  @InjectMocks private ConversationTopicOutboundInterceptor interceptor;

  private static Message<byte[]> outbound(
      SimpMessageType type, String destination, String session) {
    SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create(type);
    accessor.setDestination(destination);
    accessor.setSessionId(session);
    accessor.setLeaveMutable(true);
    return MessageBuilder.createMessage("{}".getBytes(), accessor.getMessageHeaders());
  }

  @Test
  void conversationFrame_toCurrentMember_isDelivered() {
    when(wsSessionRegistry.bindingOf("ws-1"))
        .thenReturn(new WsSessionRegistry.Binding("user-1", "sid-1"));
    when(membershipCache.isMember(CONV, "user-1")).thenReturn(true);
    Message<byte[]> frame =
        outbound(SimpMessageType.MESSAGE, "/topic/conversation/" + CONV, "ws-1");

    assertThat(interceptor.preSend(frame, channel)).isSameAs(frame);
  }

  /** A removed member keeps its subscription but must not receive the group's frames any more. */
  @Test
  void conversationFrame_toRemovedMember_isDropped() {
    when(wsSessionRegistry.bindingOf("ws-1"))
        .thenReturn(new WsSessionRegistry.Binding("user-1", "sid-1"));
    when(membershipCache.isMember(CONV, "user-1")).thenReturn(false);

    assertThat(
            interceptor.preSend(
                outbound(SimpMessageType.MESSAGE, "/topic/conversation/" + CONV, "ws-1"), channel))
        .isNull();
  }

  @Test
  void typingFrame_toRemovedMember_isDropped() {
    when(wsSessionRegistry.bindingOf("ws-1"))
        .thenReturn(new WsSessionRegistry.Binding("user-1", "sid-1"));
    when(membershipCache.isMember(CONV, "user-1")).thenReturn(false);

    assertThat(
            interceptor.preSend(
                outbound(
                    SimpMessageType.MESSAGE, "/topic/conversation/" + CONV + "/typing", "ws-1"),
                channel))
        .isNull();
  }

  @Test
  void conversationFrame_toUnboundSession_isDropped() {
    when(wsSessionRegistry.bindingOf("ws-x")).thenReturn(null);

    assertThat(
            interceptor.preSend(
                outbound(SimpMessageType.MESSAGE, "/topic/conversation/" + CONV, "ws-x"), channel))
        .isNull();
  }

  @Test
  void otherDestinationsAndFrameTypes_passUntouched() {
    Message<byte[]> presence = outbound(SimpMessageType.MESSAGE, "/topic/presence", "ws-1");
    Message<byte[]> userQueue =
        outbound(SimpMessageType.MESSAGE, "/queue/notifications-userws-1", "ws-1");
    Message<byte[]> connectAck =
        outbound(SimpMessageType.CONNECT_ACK, "/topic/conversation/" + CONV, "ws-1");

    assertThat(interceptor.preSend(presence, channel)).isSameAs(presence);
    assertThat(interceptor.preSend(userQueue, channel)).isSameAs(userQueue);
    assertThat(interceptor.preSend(connectAck, channel)).isSameAs(connectAck);
    verifyNoInteractions(membershipCache);
  }
}
