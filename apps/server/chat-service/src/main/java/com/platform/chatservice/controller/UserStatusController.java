package com.platform.chatservice.controller;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserStatusController {

  private final StringRedisTemplate redisTemplate;

  @GetMapping("/{userId}/status")
  public Map<String, Object> getStatus(@PathVariable String userId) {
    String value = redisTemplate.opsForValue().get("user:status:" + userId);
    boolean online = "online".equals(value);

    Map<String, Object> response = new java.util.HashMap<>();
    response.put("userId", userId);
    response.put("online", online);

    if (!online) {
      String lastSeen = redisTemplate.opsForValue().get("user:lastseen:" + userId);
      if (lastSeen != null) {
        try {
          long epoch = Long.parseLong(lastSeen);
          response.put("lastSeen", java.time.Instant.ofEpochMilli(epoch).toString());
        } catch (NumberFormatException ignored) {
        }
      }
    }
    return response;
  }
}
