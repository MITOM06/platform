package com.platform.chatservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.model.AiTraceData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class AiResponseListener implements MessageListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final MessageService messageService;
    private final ObjectMapper objectMapper;

    @Override
    @SuppressWarnings("null")
    public void onMessage(org.springframework.data.redis.connection.Message message, byte[] pattern) {
        try {
            Map<String, Object> payload = objectMapper.readValue(
                message.getBody(), new TypeReference<>() {});
            String type = (String) payload.get("type");
            String convId = (String) payload.get("conversationId");
            if (convId == null || type == null) {
                log.warn("AI response payload missing type or conversationId");
                return;
            }
            String topic = "/topic/conversation/" + convId;
            switch (type) {
                case "AI_STREAM_CHUNK" -> {
                    String chunk = (String) payload.getOrDefault("chunk", "");
                    messagingTemplate.convertAndSend(topic, Map.of(
                        "type", "AI_STREAM_CHUNK",
                        "chunk", chunk,
                        "senderId", AiConstants.AI_BOT_USER_ID,
                        "conversationId", convId));
                }
                case "AI_STREAM_DONE" -> {
                    String fullContent = (String) payload.get("fullContent");
                    @SuppressWarnings("unchecked")
                    Map<String, Object> traceMap = (Map<String, Object>) payload.get("trace");
                    AiTraceData trace = null;
                    if (traceMap != null) {
                        try {
                            trace = objectMapper.convertValue(traceMap, AiTraceData.class);
                        } catch (Exception ex) {
                            log.warn("Failed to deserialize AiTraceData", ex);
                        }
                    }
                    if (fullContent != null && !fullContent.isBlank()) {
                        // saveAiMessage already broadcasts the saved message to the topic,
                        // so we must NOT broadcast it again here (would duplicate on clients).
                        messageService.saveAiMessage(convId, fullContent, trace);
                    }
                    Map<String, Object> doneEvent = new HashMap<>();
                    doneEvent.put("type", "AI_STREAM_DONE");
                    doneEvent.put("senderId", AiConstants.AI_BOT_USER_ID);
                    doneEvent.put("conversationId", convId);
                    if (traceMap != null) doneEvent.put("trace", traceMap);
                    messagingTemplate.convertAndSend(topic, doneEvent);
                }
                case "AI_STREAM_ERROR" -> {
                    String error = (String) payload.getOrDefault("error", "AI is temporarily unavailable.");
                    messagingTemplate.convertAndSend(topic, Map.of(
                        "type", "AI_STREAM_ERROR",
                        "error", error,
                        "senderId", AiConstants.AI_BOT_USER_ID,
                        "conversationId", convId));
                }
                case "AI_TOOL_CALL" -> {
                    String toolName = (String) payload.getOrDefault("toolName", "");
                    String inputSummary = (String) payload.getOrDefault("inputSummary", "");
                    messagingTemplate.convertAndSend(topic, Map.of(
                        "type", "AI_TOOL_CALL",
                        "toolName", toolName,
                        "inputSummary", inputSummary,
                        "senderId", AiConstants.AI_BOT_USER_ID,
                        "conversationId", convId));
                }
                default -> log.warn("Unknown AI response type: {}", type);
            }
        } catch (Exception e) {
            log.error("Failed to process AI response message", e);
        }
    }
}
