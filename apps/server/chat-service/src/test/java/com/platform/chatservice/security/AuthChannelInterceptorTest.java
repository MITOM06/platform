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
    }
  }
}
