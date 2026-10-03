package com.platform.chatservice.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageHeaderAccessor;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class AuthChannelInterceptorTest {

  @Mock private JwtUtil jwtUtil;
  @Mock private StringRedisTemplate redisTemplate;
  @Mock private Message<?> message;
  @Mock private MessageChannel channel;
  @Mock private StompHeaderAccessor accessor;
  @Mock private com.platform.chatservice.service.ConversationQueryService conversationQueryService;
  @Mock private SessionValidator sessionValidator;
  @Mock private WsSessionRegistry wsSessionRegistry;

  @InjectMocks private AuthChannelInterceptor interceptor;

  @Test
  void preSend_WhenAccessorIsNull_ShouldPassThrough() {
    try (MockedStatic<MessageHeaderAccessor> mocked = mockStatic(MessageHeaderAccessor.class)) {
      mocked
          .when(
              () ->
                  MessageHeaderAccessor.getAccessor(
                      any(Message.class), eq(StompHeaderAccessor.class)))
          .thenReturn(null);

      Message<?> result = interceptor.preSend(message, channel);

      assertThat(result).isSameAs(message);
      verifyNoInteractions(jwtUtil);
    }
  }

  @Test
  void preSend_WhenCommandIsNotConnect_ShouldPassThrough() {
    try (MockedStatic<MessageHeaderAccessor> mocked = mockStatic(MessageHeaderAccessor.class)) {
      when(accessor.getCommand()).thenReturn(StompCommand.SEND);
      mocked
          .when(
              () ->
                  MessageHeaderAccessor.getAccessor(
                      any(Message.class), eq(StompHeaderAccessor.class)))
          .thenReturn(accessor);

      Message<?> result = interceptor.preSend(message, channel);

      assertThat(result).isSameAs(message);
      verifyNoInteractions(jwtUtil);
    }
  }

  @Test
  void preSend_WhenAuthHeaderMissing_ShouldThrow() {
    try (MockedStatic<MessageHeaderAccessor> mocked = mockStatic(MessageHeaderAccessor.class)) {
      when(accessor.getCommand()).thenReturn(StompCommand.CONNECT);
      when(accessor.getNativeHeader("Authorization")).thenReturn(null);
      mocked
          .when(
              () ->
                  MessageHeaderAccessor.getAccessor(
                      any(Message.class), eq(StompHeaderAccessor.class)))
          .thenReturn(accessor);

      assertThatThrownBy(() -> interceptor.preSend(message, channel))
          .isInstanceOf(MessageDeliveryException.class)
          .hasMessageContaining("Missing Authorization header");
    }
  }

  @Test
  void preSend_WhenAuthHeaderEmpty_ShouldThrow() {
    try (MockedStatic<MessageHeaderAccessor> mocked = mockStatic(MessageHeaderAccessor.class)) {
      when(accessor.getCommand()).thenReturn(StompCommand.CONNECT);
      when(accessor.getNativeHeader("Authorization")).thenReturn(List.of());
      mocked
          .when(
              () ->
                  MessageHeaderAccessor.getAccessor(
                      any(Message.class), eq(StompHeaderAccessor.class)))
          .thenReturn(accessor);

      assertThatThrownBy(() -> interceptor.preSend(message, channel))
          .isInstanceOf(MessageDeliveryException.class)
          .hasMessageContaining("Missing Authorization header");
    }
  }

  @Test
  void preSend_WhenHeaderLacksBearerPrefix_ShouldThrow() {
    try (MockedStatic<MessageHeaderAccessor> mocked = mockStatic(MessageHeaderAccessor.class)) {
      when(accessor.getCommand()).thenReturn(StompCommand.CONNECT);
      when(accessor.getNativeHeader("Authorization")).thenReturn(List.of("Basic sometoken"));
      mocked
          .when(
              () ->
                  MessageHeaderAccessor.getAccessor(
                      any(Message.class), eq(StompHeaderAccessor.class)))
          .thenReturn(accessor);

      assertThatThrownBy(() -> interceptor.preSend(message, channel))
          .isInstanceOf(MessageDeliveryException.class)
          .hasMessageContaining("Invalid Authorization header format");
    }
  }

  @Test
  void preSend_WhenTokenIsInvalid_ShouldThrow() {
    try (MockedStatic<MessageHeaderAccessor> mocked = mockStatic(MessageHeaderAccessor.class)) {
      when(accessor.getCommand()).thenReturn(StompCommand.CONNECT);
      when(accessor.getNativeHeader("Authorization"))
          .thenReturn(List.of("Bearer expired.or.invalid"));
      when(jwtUtil.isValid("expired.or.invalid")).thenReturn(false);
      mocked
          .when(
              () ->
                  MessageHeaderAccessor.getAccessor(
                      any(Message.class), eq(StompHeaderAccessor.class)))
          .thenReturn(accessor);

      assertThatThrownBy(() -> interceptor.preSend(message, channel))
          .isInstanceOf(MessageDeliveryException.class)
          .hasMessageContaining("Invalid or expired JWT token");
    }
  }

  @Test
  void preSend_WhenTokenIsValid_ShouldSetUserPrincipalWithRbacClaims() {
    try (MockedStatic<MessageHeaderAccessor> mocked = mockStatic(MessageHeaderAccessor.class)) {
      when(accessor.getCommand()).thenReturn(StompCommand.CONNECT);
      when(accessor.getNativeHeader("Authorization")).thenReturn(List.of("Bearer valid.jwt.token"));
      when(jwtUtil.isValid("valid.jwt.token")).thenReturn(true);
      when(jwtUtil.extractUserId("valid.jwt.token")).thenReturn("user-001");
      when(jwtUtil.extractSid("valid.jwt.token")).thenReturn("sid-1");
      when(sessionValidator.validate("sid-1", "user-001")).thenReturn(SessionStatus.VALID);
      when(accessor.getSessionId()).thenReturn("ws-1");
      when(jwtUtil.extractRole("valid.jwt.token")).thenReturn("Manager");
      when(jwtUtil.extractPerms("valid.jwt.token")).thenReturn(List.of("VIEW_INTERNAL_CONTEXT"));
      when(jwtUtil.extractDepts("valid.jwt.token")).thenReturn(List.of("d1"));
      mocked
          .when(
              () ->
                  MessageHeaderAccessor.getAccessor(
                      any(Message.class), eq(StompHeaderAccessor.class)))
          .thenReturn(accessor);

      Message<?> result = interceptor.preSend(message, channel);

      assertThat(result).isSameAs(message);
      verify(accessor)
          .setUser(
              argThat(
                  principal ->
                      principal instanceof UserPrincipal up
                          && "user-001".equals(up.getName())
                          && "Manager".equals(up.getRole())
                          && up.getPerms().contains("VIEW_INTERNAL_CONTEXT")
                          && up.getDepts().contains("d1")));
      verify(wsSessionRegistry).bind("ws-1", "user-001", "sid-1");
    }
  }

  @Test
  void preSend_Connect_WhenSessionRevoked_ShouldRejectWithCode() {
    try (MockedStatic<MessageHeaderAccessor> mocked = mockAccessor()) {
      when(accessor.getCommand()).thenReturn(StompCommand.CONNECT);
      when(accessor.getNativeHeader("Authorization")).thenReturn(List.of("Bearer valid.jwt.token"));
      when(jwtUtil.isValid("valid.jwt.token")).thenReturn(true);
      when(jwtUtil.extractUserId("valid.jwt.token")).thenReturn("user-001");
      when(jwtUtil.extractSid("valid.jwt.token")).thenReturn("sid-1");
      when(sessionValidator.validate("sid-1", "user-001"))
          .thenReturn(SessionStatus.SESSION_REVOKED);

      assertThatThrownBy(() -> interceptor.preSend(message, channel))
          .isInstanceOf(MessageDeliveryException.class)
          .hasMessageContaining("SESSION_REVOKED");
      verify(accessor, never()).setUser(any());
      verify(wsSessionRegistry, never()).bind(any(), any(), any());
    }
  }

  @Test
  void preSend_Connect_WhenTokenHasNoSid_ShouldReject() {
    try (MockedStatic<MessageHeaderAccessor> mocked = mockAccessor()) {
      when(accessor.getCommand()).thenReturn(StompCommand.CONNECT);
      when(accessor.getNativeHeader("Authorization")).thenReturn(List.of("Bearer legacy.token"));
      when(jwtUtil.isValid("legacy.token")).thenReturn(true);
      when(jwtUtil.extractUserId("legacy.token")).thenReturn("user-001");
      when(jwtUtil.extractSid("legacy.token")).thenReturn(null);
      when(sessionValidator.validate(null, "user-001")).thenReturn(SessionStatus.TOKEN_INVALID);

      assertThatThrownBy(() -> interceptor.preSend(message, channel))
          .isInstanceOf(MessageDeliveryException.class)
          .hasMessageContaining("TOKEN_INVALID");
    }
  }

  @Test
  void preSend_Send_WhenSessionRevoked_ShouldCloseSocketAndDropFrame() {
    try (MockedStatic<MessageHeaderAccessor> mocked = mockAccessor()) {
      when(accessor.getCommand()).thenReturn(StompCommand.SEND);
      when(accessor.getUser()).thenReturn(new UserPrincipal("user-001"));
      when(accessor.getSessionId()).thenReturn("ws-1");
      when(wsSessionRegistry.bindingOf("ws-1"))
          .thenReturn(new WsSessionRegistry.Binding("user-001", "sid-1"));
      when(sessionValidator.validate("sid-1", "user-001"))
          .thenReturn(SessionStatus.SESSION_REVOKED);

      assertThat(interceptor.preSend(message, channel)).isNull();
      verify(wsSessionRegistry).closeSession("ws-1", "SESSION_REVOKED");
      verifyNoInteractions(redisTemplate); // no presence refresh for a dead session
    }
  }

  @Test
  void preSend_Subscribe_WhenSessionRevoked_ShouldCloseSocketAndDropFrame() {
    try (MockedStatic<MessageHeaderAccessor> mocked = mockAccessor()) {
      when(accessor.getCommand()).thenReturn(StompCommand.SUBSCRIBE);
      when(accessor.getUser()).thenReturn(new UserPrincipal("user-001"));
      when(accessor.getSessionId()).thenReturn("ws-1");
      when(wsSessionRegistry.bindingOf("ws-1"))
          .thenReturn(new WsSessionRegistry.Binding("user-001", "sid-1"));
      when(sessionValidator.validate("sid-1", "user-001"))
          .thenReturn(SessionStatus.SESSION_NOT_FOUND);

      assertThat(interceptor.preSend(message, channel)).isNull();
      verify(wsSessionRegistry).closeSession("ws-1", "SESSION_NOT_FOUND");
      verifyNoInteractions(conversationQueryService);
    }
  }

  @Test
  void preSend_Send_WhenSessionValid_ShouldPassAndRefreshPresence() {
    try (MockedStatic<MessageHeaderAccessor> mocked = mockAccessor()) {
      @SuppressWarnings("unchecked")
      org.springframework.data.redis.core.ValueOperations<String, String> ops =
          mock(org.springframework.data.redis.core.ValueOperations.class);
      when(redisTemplate.opsForValue()).thenReturn(ops);
      when(accessor.getCommand()).thenReturn(StompCommand.SEND);
      when(accessor.getUser()).thenReturn(new UserPrincipal("user-001"));
      when(accessor.getSessionId()).thenReturn("ws-1");
      when(wsSessionRegistry.bindingOf("ws-1"))
          .thenReturn(new WsSessionRegistry.Binding("user-001", "sid-1"));
      when(sessionValidator.validate("sid-1", "user-001")).thenReturn(SessionStatus.VALID);

      assertThat(interceptor.preSend(message, channel)).isSameAs(message);
      verify(wsSessionRegistry, never()).closeSession(any(), any());
      verify(ops).set(eq("user:status:user-001"), eq("online"), any(java.time.Duration.class));
    }
  }

  @Test
  void preSend_Send_WhenSessionStoreDown_ShouldRejectFrameButKeepSocket() {
    try (MockedStatic<MessageHeaderAccessor> mocked = mockAccessor()) {
      when(accessor.getCommand()).thenReturn(StompCommand.SEND);
      when(accessor.getUser()).thenReturn(new UserPrincipal("user-001"));
      when(accessor.getSessionId()).thenReturn("ws-1");
      when(wsSessionRegistry.bindingOf("ws-1"))
          .thenReturn(new WsSessionRegistry.Binding("user-001", "sid-1"));
      when(sessionValidator.validate("sid-1", "user-001")).thenReturn(SessionStatus.UNAVAILABLE);

      assertThatThrownBy(() -> interceptor.preSend(message, channel))
          .isInstanceOf(MessageDeliveryException.class)
          .hasMessageContaining("SESSION_CHECK_UNAVAILABLE");
      verify(wsSessionRegistry, never()).closeSession(any(), any());
    }
  }

  private MockedStatic<MessageHeaderAccessor> mockAccessor() {
    MockedStatic<MessageHeaderAccessor> mocked = mockStatic(MessageHeaderAccessor.class);
    mocked
        .when(
            () ->
                MessageHeaderAccessor.getAccessor(
                    any(Message.class), eq(StompHeaderAccessor.class)))
        .thenReturn(accessor);
    return mocked;
  }
}
