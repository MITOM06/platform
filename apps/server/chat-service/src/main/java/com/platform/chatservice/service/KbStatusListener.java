package com.platform.chatservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.repository.KbDocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class KbStatusListener implements MessageListener {

    private final KbDocumentRepository kbDocumentRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            Map<String, Object> data = objectMapper.readValue(
                message.getBody(), new TypeReference<>() {});

            String type = (String) data.get("type");
            String documentId = (String) data.get("documentId");
            String conversationId = (String) data.get("conversationId");

            if (documentId == null) return;

            if ("KB_DONE".equals(type)) {
                int chunkCount = data.containsKey("chunkCount")
                    ? ((Number) data.get("chunkCount")).intValue()
                    : 0;

                kbDocumentRepository.findByDocumentId(documentId).ifPresent(doc -> {
                    doc.setStatus("done");
                    doc.setChunkCount(chunkCount);
                    kbDocumentRepository.save(doc);

                    if (conversationId != null) {
                        Map<String, Object> event = new HashMap<>();
                        event.put("type", "KB_STATUS_UPDATE");
                        event.put("documentId", documentId);
                        event.put("status", "done");
                        event.put("chunkCount", chunkCount);
                        messagingTemplate.convertAndSend(
                            "/topic/conversation/" + conversationId, event);
                    }
                });

            } else if ("KB_ERROR".equals(type)) {
                kbDocumentRepository.findByDocumentId(documentId).ifPresent(doc -> {
                    doc.setStatus("error");
                    kbDocumentRepository.save(doc);

                    if (conversationId != null) {
                        Map<String, Object> event = new HashMap<>();
                        event.put("type", "KB_STATUS_UPDATE");
                        event.put("documentId", documentId);
                        event.put("status", "error");
                        messagingTemplate.convertAndSend(
                            "/topic/conversation/" + conversationId, event);
                    }
                });
            }
        } catch (Exception e) {
            log.error("Failed to process kb:status message", e);
        }
    }
}
