package com.platform.chatservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.dto.MessageResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.connection.Message;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiResponseListenerTest {

    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private MessageService messageService;
    @Mock private Message redisMessage;

    @InjectMocks
    private AiResponseListener listener;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        // Inject real ObjectMapper via field to override the mock-constructed one.
        // Mockito @InjectMocks uses constructor injection; manually set the real mapper.
        listener = new AiResponseListener(messagingTemplate, messageService, objectMapper);
    }

    @Test
    void onMessage_AI_STREAM_CHUNK_broadcastsChunkToTopic() throws Exception {
        Map<String, Object> payload = Map.of(
            "type", "AI_STREAM_CHUNK",
            "chunk", "Hello",
            "conversationId", "conv-1"
        );
        when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));

        listener.onMessage(redisMessage, null);

        verify(messagingTemplate).convertAndSend(
            eq("/topic/conversation/conv-1"),
            (Object) argThat(arg -> arg instanceof Map
                && "AI_STREAM_CHUNK".equals(((Map<?, ?>) arg).get("type"))
                && "Hello".equals(((Map<?, ?>) arg).get("chunk"))
                && AiConstants.AI_BOT_USER_ID.equals(((Map<?, ?>) arg).get("senderId"))));
    }

    @Test
    void onMessage_AI_STREAM_DONE_savesMessageAndBroadcastsBoth() throws Exception {
        Map<String, Object> payload = Map.of(
            "type", "AI_STREAM_DONE",
            "fullContent", "Full AI reply",
            "conversationId", "conv-1"
        );
        when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));
        MessageResponse saved = new MessageResponse(
            "msg-ai-1", "conv-1", AiConstants.AI_BOT_USER_ID,
            "Full AI reply", "ai", List.of(), Instant.now());
        when(messageService.saveAiMessage(eq("conv-1"), eq("Full AI reply"), isNull())).thenReturn(saved);

        listener.onMessage(redisMessage, null);

        verify(messageService).saveAiMessage(eq("conv-1"), eq("Full AI reply"), isNull());
        verify(messagingTemplate).convertAndSend(eq("/topic/conversation/conv-1"), (Object) eq(saved));
        verify(messagingTemplate).convertAndSend(
            eq("/topic/conversation/conv-1"),
            (Object) argThat(arg -> arg instanceof Map && "AI_STREAM_DONE".equals(((Map<?, ?>) arg).get("type"))));
    }

    @Test
    void onMessage_AI_STREAM_ERROR_broadcastsErrorEvent() throws Exception {
        Map<String, Object> payload = Map.of(
            "type", "AI_STREAM_ERROR",
            "error", "AI unavailable",
            "conversationId", "conv-1"
        );
        when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));

        listener.onMessage(redisMessage, null);

        verify(messageService, never()).saveAiMessage(any(), any(), any());
        verify(messagingTemplate).convertAndSend(
            eq("/topic/conversation/conv-1"),
            (Object) argThat(arg -> arg instanceof Map
                && "AI_STREAM_ERROR".equals(((Map<?, ?>) arg).get("type"))
                && "AI unavailable".equals(((Map<?, ?>) arg).get("error"))));
    }

    @Test
    void onMessage_AI_TOOL_CALL_broadcastsToolCallToTopic() throws Exception {
        Map<String, Object> payload = Map.of(
            "type", "AI_TOOL_CALL",
            "toolName", "search_messages",
            "inputSummary", "{\"query\":\"Flutter\"}",
            "conversationId", "conv-1"
        );
        when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));

        listener.onMessage(redisMessage, null);

        verify(messagingTemplate).convertAndSend(
            eq("/topic/conversation/conv-1"),
            (Object) argThat(arg -> arg instanceof Map
                && "AI_TOOL_CALL".equals(((Map<?, ?>) arg).get("type"))
                && "search_messages".equals(((Map<?, ?>) arg).get("toolName"))
                && AiConstants.AI_BOT_USER_ID.equals(((Map<?, ?>) arg).get("senderId"))));
    }

    @Test
    void onMessage_missingConversationId_doesNothing() throws Exception {
        Map<String, Object> payload = Map.of("type", "AI_STREAM_CHUNK", "chunk", "hi");
        when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));

        listener.onMessage(redisMessage, null);

        verifyNoInteractions(messagingTemplate, messageService);
    }
}
