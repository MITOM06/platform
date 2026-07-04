package com.platform.chatservice.config;

import com.platform.chatservice.security.AuthChannelInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

  private final AuthChannelInterceptor authChannelInterceptor;

  @Value("${app.cors.allowed-origins:*}")
  private String allowedOrigins;

  @Override
  public void registerStompEndpoints(StompEndpointRegistry registry) {
    String[] origins =
        java.util.Arrays.stream(allowedOrigins.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toArray(String[]::new);
    registry.addEndpoint("/ws").setAllowedOriginPatterns(origins);
  }

  @Override
  public void configureMessageBroker(MessageBrokerRegistry registry) {
    registry.setApplicationDestinationPrefixes("/app");
    // Broker phải handle các destination ĐÃ RESOLVE: /topic (broadcast) và
    // /queue (user destination resolve thành /queue/...-user{session}).
    // KHÔNG để "/user" ở đây — "/user" là userDestinationPrefix, do
    // UserDestinationMessageHandler xử lý, không phải broker. Thiếu "/queue"
    // khiến convertAndSendToUser(.../queue/notifications) bị broker drop.
    registry.enableSimpleBroker("/topic", "/queue");
    registry.setUserDestinationPrefix("/user");
  }

  @Override
  public void configureClientInboundChannel(ChannelRegistration registration) {
    registration.interceptors(authChannelInterceptor);
  }

  /**
   * DoS guard on the STOMP transport. Caps a single inbound STOMP frame at 64KB (message content is
   * separately capped at 10,000 chars via {@code @Size}, so this only needs headroom for frame
   * headers/metadata), bounds the per-session send buffer, and times out a slow-consuming client
   * instead of letting its buffer grow unbounded.
   */
  @Override
  public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
    registration
        .setMessageSizeLimit(64 * 1024) // 64KB max per STOMP message
        .setSendBufferSizeLimit(512 * 1024) // 512KB send buffer per session
        .setSendTimeLimit(20_000); // 20s timeout if a client receives slowly
  }
}
