package com.platform.chatservice.security;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.time.Duration;
import java.util.List;

@Component
@RequiredArgsConstructor
public class AuthChannelInterceptor implements ChannelInterceptor {

    private static final String STATUS_KEY_PREFIX = "user:status:";
    private static final Duration ONLINE_TTL = Duration.ofMinutes(5);

    private final JwtUtil jwtUtil;
    private final StringRedisTemplate redisTemplate;

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            List<String> authHeaders = accessor.getNativeHeader("Authorization");
            if (authHeaders == null || authHeaders.isEmpty()) {
                throw new MessageDeliveryException("Missing Authorization header");
            }

            String header = authHeaders.get(0);
            if (!header.startsWith("Bearer ")) {
                throw new MessageDeliveryException("Invalid Authorization header format");
            }

            String token = header.substring(7);
            if (!jwtUtil.isValid(token)) {
                throw new MessageDeliveryException("Invalid or expired JWT token");
            }

            String userId = jwtUtil.extractUserId(token);
            accessor.setUser(new UsernamePasswordAuthenticationToken(userId, null, List.of()));
            refreshPresence(userId);
            return message;
        }

        // For all subsequent messages, refresh the online TTL to act as a heartbeat
        Principal user = accessor.getUser();
        if (user != null) {
            refreshPresence(user.getName());
        }

        return message;
    }

    @SuppressWarnings("null")
    private void refreshPresence(String userId) {
        redisTemplate.expire(STATUS_KEY_PREFIX + userId, ONLINE_TTL);
    }
}
