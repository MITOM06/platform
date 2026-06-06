package com.platform.chatservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.dto.AiRequestPayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiRedisPublisher {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public void publishAiRequest(String conversationId, String userId, String displayName,
                                  String content, List<Map<String, String>> history) {
        AiRequestPayload payload = new AiRequestPayload(conversationId, userId, displayName, content, history);
        try {
            String json = objectMapper.writeValueAsString(payload);
            redisTemplate.convertAndSend(AiConstants.AI_REQUEST_CHANNEL, json);
            log.debug("Published AI request for conversation {}", conversationId);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize AI request for conversation {}", conversationId, e);
        }
    }
}
