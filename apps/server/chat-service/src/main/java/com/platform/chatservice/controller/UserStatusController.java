package com.platform.chatservice.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserStatusController {

    private final StringRedisTemplate redisTemplate;

    @GetMapping("/{userId}/status")
    public Map<String, Object> getStatus(@PathVariable String userId) {
        String value = redisTemplate.opsForValue().get("user:status:" + userId);
        return Map.of(
            "userId", userId,
            "online", "online".equals(value)
        );
    }
}
