package com.platform.chatservice.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.service.ConversationQueryService;
import com.platform.chatservice.service.PresenceService;
import com.platform.chatservice.service.meeting.MeetingTopicAuthorizer;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;

/**
 * Inbound STOMP gate. Uses real {@link StompHeaderAccessor}s / messages (no static mocking) so the
 * interceptor sees exactly what Spring's StompSubProtocolHandler hands it.
 */
@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class AuthChannelInterceptorTest {

  private static final String USER = "user-001";
  private static final String WS = "ws-1";
  private static final String CONV = "64b7f0c2a1b2c3d4e5f60718";
  private static final Long IAT = 1_700_000_000L;

  @Mock private JwtUtil jwtUtil;
  @Mock private MessageChannel channel;
  @Mock private ConversationQueryService conversationQueryService;
  @Mock private SessionValidator sessionValidator;
  @Mock private WsSessionRegistry wsSessionRegistry;
  @Mock private PresenceService presenceService;
  @Mock private MeetingTopicAuthorizer meetingTopics;

  @InjectMocks private AuthChannelInterceptor interceptor;

  // ---------------------------------------------------------------- helpers

  private static Message<byte[]> frame(StompCommand command, String destination, boolean withUser) {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
    accessor.setSessionId(WS);
    if (destination != null) {
      accessor.setDestination(destination);
    }
    if (command == StompCommand.SUBSCRIBE) {
      accessor.setSubscriptionId("sub-0");
    }
    if (withUser) {
      accessor.setUser(new UserPrincipal(USER));
    }
    accessor.setLeaveMutable(true);
    return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
  }

  private static Message<byte[]> connect(String authorization) {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
    accessor.setSessionId(WS);
    if (authorization != null) {
      accessor.setNativeHeader("Authorization", authorization);
    }
    accessor.setLeaveMutable(true);
    return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
  }

  private void sessionValid() {
    when(wsSessionRegistry.bindingOf(WS)).thenReturn(new WsSessionRegistry.Binding(USER, "sid-1"));
    when(sessionValidator.validate("sid-1", USER)).thenReturn(SessionStatus.VALID);
  }

  // ---------------------------------------------------------------- CONNECT

  @Test
  void nonStompMessage_passesThrough() {
    Message<byte[]> plain = MessageBuilder.withPayload(new byte[0]).build();

    assertThat(interceptor.preSend(plain, channel)).isSameAs(plain);
    verifyNoInteractions(jwtUtil, presenceService);
  }

  @Test
  void connect_withoutAuthorization_isRejected() {
    assertThatThrownBy(() -> interceptor.preSend(connect(null), channel))
        .isInstanceOf(MessageDeliveryException.class)
        .hasMessageContaining("Missing Authorization header");
  }

  @Test
  void connect_withoutBearerPrefix_isRejected() {
    assertThatThrownBy(() -> interceptor.preSend(connect("Basic sometoken"), channel))
        .isInstanceOf(MessageDeliveryException.class)
        .hasMessageContaining("Invalid Authorization header format");
  }

  @Test
  void connect_withInvalidToken_isRejected() {
    when(jwtUtil.isValid("expired.or.invalid")).thenReturn(false);

    assertThatThrownBy(() -> interceptor.preSend(connect("Bearer expired.or.invalid"), channel))
        .isInstanceOf(MessageDeliveryException.class)
        .hasMessageContaining("Invalid or expired JWT token");
  }

  @Test
  void connect_withValidToken_setsPrincipalWithRbacClaims_andBindsSession() {
    when(jwtUtil.isValid("valid.jwt.token")).thenReturn(true);
    when(jwtUtil.extractUserId("valid.jwt.token")).thenReturn(USER);
    when(jwtUtil.extractSid("valid.jwt.token")).thenReturn("sid-1");
    when(jwtUtil.extractIssuedAtSeconds("valid.jwt.token")).thenReturn(IAT);
    when(sessionValidator.validateToken("sid-1", USER, IAT)).thenReturn(SessionStatus.VALID);
    when(jwtUtil.extractRole("valid.jwt.token")).thenReturn("Manager");
    when(jwtUtil.extractPerms("valid.jwt.token")).thenReturn(List.of("VIEW_INTERNAL_CONTEXT"));
    when(jwtUtil.extractDepts("valid.jwt.token")).thenReturn(List.of("d1"));
    Message<byte[]> message = connect("Bearer valid.jwt.token");

    Message<?> result = interceptor.preSend(message, channel);

    assertThat(result).isSameAs(message);
    UserPrincipal principal =
        (UserPrincipal)
            MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class).getUser();
    assertThat(principal.getName()).isEqualTo(USER);
    assertThat(principal.getRole()).isEqualTo("Manager");
    assertThat(principal.getPerms()).contains("VIEW_INTERNAL_CONTEXT");
    assertThat(principal.getDepts()).contains("d1");
    verify(wsSessionRegistry).bind(WS, USER, "sid-1");
  }

  @Test
  void connect_whenSessionRevoked_isRejectedWithCode() {
    when(jwtUtil.isValid("valid.jwt.token")).thenReturn(true);
    when(jwtUtil.extractUserId("valid.jwt.token")).thenReturn(USER);
    when(jwtUtil.extractSid("valid.jwt.token")).thenReturn("sid-1");
    when(jwtUtil.extractIssuedAtSeconds("valid.jwt.token")).thenReturn(IAT);
    when(sessionValidator.validateToken("sid-1", USER, IAT))
        .thenReturn(SessionStatus.SESSION_REVOKED);

    assertThatThrownBy(() -> interceptor.preSend(connect("Bearer valid.jwt.token"), channel))
        .isInstanceOf(MessageDeliveryException.class)
        .hasMessageContaining("SESSION_REVOKED");
    verify(wsSessionRegistry, never()).bind(any(), any(), any());
  }

  @Test
  void connect_tokenWithoutSid_isRejected() {
    when(jwtUtil.isValid("legacy.token")).thenReturn(true);
    when(jwtUtil.extractUserId("legacy.token")).thenReturn(USER);
    when(jwtUtil.extractSid("legacy.token")).thenReturn(null);
    when(sessionValidator.validateToken(isNull(), eq(USER), any()))
        .thenReturn(SessionStatus.TOKEN_INVALID);

    assertThatThrownBy(() -> interceptor.preSend(connect("Bearer legacy.token"), channel))
        .isInstanceOf(MessageDeliveryException.class)
        .hasMessageContaining("TOKEN_INVALID");
  }

  /** F1: CONNECT with a token minted before the user's claims changed is refused with the code. */
  @Test
  void connect_withStaleClaims_isRejectedWithCode() {
    when(jwtUtil.isValid("valid.jwt.token")).thenReturn(true);
    when(jwtUtil.extractUserId("valid.jwt.token")).thenReturn(USER);
    when(jwtUtil.extractSid("valid.jwt.token")).thenReturn("sid-1");
    when(jwtUtil.extractIssuedAtSeconds("valid.jwt.token")).thenReturn(IAT);
    when(sessionValidator.validateToken("sid-1", USER, IAT))
        .thenReturn(SessionStatus.TOKEN_CLAIMS_STALE);

    assertThatThrownBy(() -> interceptor.preSend(connect("Bearer valid.jwt.token"), channel))
        .isInstanceOf(MessageDeliveryException.class)
        .hasMessage("TOKEN_CLAIMS_STALE");
    verify(wsSessionRegistry, never()).bind(any(), any(), any());
  }

  /** F1: frames on an already-open socket only re-check revocation, never claims freshness. */
  @Test
  void send_onOpenSocket_neverChecksClaimsFreshness() {
    sessionValid();

    Message<byte[]> message = frame(StompCommand.SEND, "/app/chat.send", true);
    assertThat(interceptor.preSend(message, channel)).isSameAs(message);
    verify(sessionValidator).validate("sid-1", USER);
    verify(sessionValidator, never()).validateToken(any(), any(), any());
  }

  /** STOMP 1.2 allows a "STOMP" frame instead of CONNECT — it must be authenticated too. */
  @Test
  void stompFrame_isAuthenticatedLikeConnect() {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.STOMP);
    accessor.setSessionId(WS);
    accessor.setLeaveMutable(true);
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

    assertThatThrownBy(() -> interceptor.preSend(message, channel))
        .isInstanceOf(MessageDeliveryException.class)
        .hasMessageContaining("Missing Authorization header");
  }

  // ---------------------------------------------------------------- session re-validation

  @Test
  void send_whenSessionRevoked_closesSocketAndDropsFrame() {
    when(wsSessionRegistry.bindingOf(WS)).thenReturn(new WsSessionRegistry.Binding(USER, "sid-1"));
    when(sessionValidator.validate("sid-1", USER)).thenReturn(SessionStatus.SESSION_REVOKED);

    assertThat(interceptor.preSend(frame(StompCommand.SEND, "/app/chat.send", true), channel))
        .isNull();
    verify(wsSessionRegistry).closeSession(WS, "SESSION_REVOKED");
    verifyNoInteractions(presenceService); // no presence refresh for a dead session
  }

  @Test
  void subscribe_whenSessionNotFound_closesSocketAndDropsFrame() {
    when(wsSessionRegistry.bindingOf(WS)).thenReturn(new WsSessionRegistry.Binding(USER, "sid-1"));
    when(sessionValidator.validate("sid-1", USER)).thenReturn(SessionStatus.SESSION_NOT_FOUND);

    assertThat(
            interceptor.preSend(
                frame(StompCommand.SUBSCRIBE, "/topic/conversation/" + CONV, true), channel))
        .isNull();
    verify(wsSessionRegistry).closeSession(WS, "SESSION_NOT_FOUND");
    verifyNoInteractions(conversationQueryService);
  }

  @Test
  void send_whenSessionStoreDown_rejectsFrameButKeepsSocket() {
    when(wsSessionRegistry.bindingOf(WS)).thenReturn(new WsSessionRegistry.Binding(USER, "sid-1"));
    when(sessionValidator.validate("sid-1", USER)).thenReturn(SessionStatus.UNAVAILABLE);

    assertThatThrownBy(
            () -> interceptor.preSend(frame(StompCommand.SEND, "/app/chat.send", true), channel))
        .isInstanceOf(MessageDeliveryException.class)
        .hasMessageContaining("SESSION_CHECK_UNAVAILABLE");
    verify(wsSessionRegistry, never()).closeSession(any(), any());
  }

  // ---------------------------------------------------------------- SEND rules

  @Test
  void send_toApplicationDestination_passes_andRefreshesPresence() {
    sessionValid();
    Message<byte[]> message = frame(StompCommand.SEND, "/app/chat.send", true);

    assertThat(interceptor.preSend(message, channel)).isSameAs(message);
    verify(wsSessionRegistry, never()).closeSession(any(), any());
    verify(presenceService).touch(USER, WS);
  }

  /** A forged frame sent straight to a broker destination must never reach subscribers. */
  @ParameterizedTest
  @ValueSource(
      strings = {
        "/topic/conversation/" + CONV,
        "/topic/conversation/" + CONV + "/typing",
        "/topic/presence",
        "/queue/notifications",
        "/user/user-002/queue/notifications",
        "/user/queue/webrtc",
        "/app/../topic/conversation/" + CONV,
        "/app/",
        "chat.send"
      })
  void send_outsideApplicationPrefix_isRefused(String destination) {
    sessionValid();

    assertThatThrownBy(
            () -> interceptor.preSend(frame(StompCommand.SEND, destination, true), channel))
        .isInstanceOf(MessageDeliveryException.class)
        .hasMessageContaining(AuthChannelInterceptor.FORBIDDEN_DESTINATION);
  }

  @Test
  void send_withoutAuthenticatedUser_isRefused() {
    assertThatThrownBy(
            () -> interceptor.preSend(frame(StompCommand.SEND, "/app/chat.send", false), channel))
        .isInstanceOf(MessageDeliveryException.class);
  }

  // ---------------------------------------------------------------- SUBSCRIBE rules

  @ParameterizedTest
  @ValueSource(
      strings = {
        "/user/queue/notifications",
        "/user/queue/webrtc",
        "/topic/presence",
        "/user/queue/meeting"
      })
  void subscribe_toUserQueuesAndPresence_passesWithoutMembershipLookup(String destination) {
    sessionValid();
    Message<byte[]> message = frame(StompCommand.SUBSCRIBE, destination, true);

    assertThat(interceptor.preSend(message, channel)).isSameAs(message);
    verifyNoInteractions(conversationQueryService);
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "/typing"})
  void subscribe_toConversationTopics_asMember_passes(String suffix) {
    sessionValid();
    when(conversationQueryService.getParticipants(CONV)).thenReturn(List.of(USER, "user-002"));
    Message<byte[]> message =
        frame(StompCommand.SUBSCRIBE, "/topic/conversation/" + CONV + suffix, true);

    assertThat(interceptor.preSend(message, channel)).isSameAs(message);
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "/typing"})
  void subscribe_toConversationTopics_asNonMember_isRefused(String suffix) {
    sessionValid();
    when(conversationQueryService.getParticipants(CONV))
        .thenReturn(List.of("user-002", "user-003"));

    assertThatThrownBy(
            () ->
                interceptor.preSend(
                    frame(StompCommand.SUBSCRIBE, "/topic/conversation/" + CONV + suffix, true),
                    channel))
        .isInstanceOf(MessageDeliveryException.class)
        .hasMessageContaining(AuthChannelInterceptor.UNAUTHORIZED_SUBSCRIPTION);
  }

  /** The E2E leak: a non-member subscribed to /topic/** and received another pair's DM. */
  @ParameterizedTest
  @ValueSource(
      strings = {
        "/topic/**",
        "/topic/*",
        "/topic/conversation/**",
        "/topic/conversation/*",
        "/topic/conversation/*/typing",
        "/topic/conversation/{id}",
        "/topic/conversation/" + CONV + "?x=1",
        "/topic/conversation/../presence",
        "/topic/conversation/",
        "/topic/conversation/" + CONV + "/other",
        "/topic/somethingElse",
        "/queue/notifications-userws-2",
        "/user/user-002/queue/notifications",
        "/app/chat.send",
        "/topic/meeting/*",
        "/topic/meeting/",
        "/"
      })
  void subscribe_outsideAllowList_isRefusedBeforeAnyLookup(String destination) {
    sessionValid();

    assertThatThrownBy(
            () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, destination, true), channel))
        .isInstanceOf(MessageDeliveryException.class)
        .hasMessageContaining(AuthChannelInterceptor.FORBIDDEN_DESTINATION);
    verifyNoInteractions(conversationQueryService);
    verifyNoInteractions(meetingTopics);
  }

  @Test
  void subscribe_toMeetingTopic_whenAllowedIntoTheRoom_passes() {
    sessionValid();
    when(meetingTopics.canSubscribe(eq("m1"), any(UserPrincipal.class))).thenReturn(true);
    Message<byte[]> message = frame(StompCommand.SUBSCRIBE, "/topic/meeting/m1", true);

    assertThat(interceptor.preSend(message, channel)).isSameAs(message);
    verifyNoInteractions(conversationQueryService);
  }

  @Test
  void subscribe_toMeetingTopic_whileWaitingOrRemoved_isRefused() {
    sessionValid();
    when(meetingTopics.canSubscribe(eq("m1"), any(UserPrincipal.class))).thenReturn(false);

    assertThatThrownBy(
            () ->
                interceptor.preSend(
                    frame(StompCommand.SUBSCRIBE, "/topic/meeting/m1", true), channel))
        .isInstanceOf(MessageDeliveryException.class)
        .hasMessageContaining(AuthChannelInterceptor.UNAUTHORIZED_SUBSCRIPTION);
  }

  @Test
  void subscribe_withoutDestination_isRefused() {
    sessionValid();

    assertThatThrownBy(
            () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, null, true), channel))
        .isInstanceOf(MessageDeliveryException.class);
  }

  // ---------------------------------------------------------------- presence

  /** Heartbeats used to return early, so idle-but-connected users fell offline after 5 min. */
  @Test
  void heartbeat_refreshesPresence() {
    StompHeaderAccessor heartbeat = StompHeaderAccessor.createForHeartbeat();
    heartbeat.setSessionId(WS);
    heartbeat.setUser(new UserPrincipal(USER));
    heartbeat.setLeaveMutable(true);
    Message<byte[]> message =
        MessageBuilder.createMessage(new byte[0], heartbeat.getMessageHeaders());

    assertThat(interceptor.preSend(message, channel)).isSameAs(message);
    verify(presenceService).touch(USER, WS);
    verifyNoInteractions(sessionValidator);
  }

  @Test
  void disconnect_doesNotRefreshPresence() {
    Message<byte[]> message = frame(StompCommand.DISCONNECT, null, true);

    assertThat(interceptor.preSend(message, channel)).isSameAs(message);
    verify(presenceService, never()).touch(anyString(), anyString());
  }
}
