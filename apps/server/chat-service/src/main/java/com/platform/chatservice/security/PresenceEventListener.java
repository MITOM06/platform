package com.platform.chatservice.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.Duration;

@Component
@RequiredArgsConstructor
public class PresenceEventListener {

    private static final String STATUS_KEY_PREFIX = "user:status:";
    private static final Duration ONLINE_TTL = Duration.ofMinutes(5);

    private final StringRedisTemplate redisTemplate;

    @EventListener
    public void onConnect(SessionConnectedEvent event) {
        // SessionConnectedEvent fires after AuthChannelInterceptor has set the Principal
        Principal user = StompHeaderAccessor.wrap(event.getMessage()).getUser();
        if (user == null) return;
        redisTemplate.opsForValue().set(STATUS_KEY_PREFIX + user.getName(), "online", ONLINE_TTL);
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        Principal user = StompHeaderAccessor.wrap(event.getMessage()).getUser();
        if (user == null) return;
        redisTemplate.delete(STATUS_KEY_PREFIX + user.getName());
        redisTemplate.opsForValue().set("user:lastseen:" + user.getName(), String.valueOf(System.currentTimeMillis()));
    }
}
