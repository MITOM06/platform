package com.platform.chatservice.service;

import com.platform.chatservice.config.RabbitMqConfig;
import com.platform.chatservice.dto.AiRequestPayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiRedisPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publishAiRequest(String conversationId, String userId, String displayName,
                                  String content, List<Map<String, String>> history) {
        AiRequestPayload payload = new AiRequestPayload(conversationId, userId, displayName, content, history);
        rabbitTemplate.convertAndSend(RabbitMqConfig.AI_EXCHANGE, RabbitMqConfig.AI_ROUTING_KEY, payload);
        log.debug("Published AI request via RabbitMQ for conversation {}", conversationId);
    }
}
