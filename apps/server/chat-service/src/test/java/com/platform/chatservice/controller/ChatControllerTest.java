package com.platform.chatservice.controller;

import com.platform.chatservice.dto.ChatMessageDto;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.MessageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class ChatControllerTest {

    @Mock
    private MessageService messageService;

    @Mock
    private ConversationService conversationService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private Principal principal;

    @InjectMocks
    private ChatController chatController;

    private ChatMessageDto chatDto;
    private final String SENDER_ID = "user-123";

    @BeforeEach
    void setUp() {
        chatDto = new ChatMessageDto("conv-456", "Hello", "text", false, null, null);
        when(principal.getName()).thenReturn(SENDER_ID);
    }

    @Test
    void send_ShouldSendMessageAndBroadcast() {
        MessageResponse response = new MessageResponse("msg-999", "conv-456", SENDER_ID, "Hello", "text", List.of(SENDER_ID), Instant.now());

        when(conversationService.getParticipants("conv-456")).thenReturn(List.of(SENDER_ID, "user-456"));
        when(messageService.sendMessage(eq(SENDER_ID), any(SendMessageRequest.class))).thenReturn(response);

        chatController.send(chatDto, principal);

        verify(messageService, times(1)).sendMessage(eq(SENDER_ID), any(SendMessageRequest.class));
        verify(messagingTemplate, times(1)).convertAndSend(
                eq("/topic/conversation/conv-456"),
                eq(response)
        );
        verify(messagingTemplate, times(1)).convertAndSendToUser(
                eq("user-456"),
                eq("/queue/notifications"),
                any(Map.class)
        );
    }

    @Test
    void typing_ShouldBroadcastTypingStatus() {
        chatDto.setTyping(true);

        chatController.typing(chatDto, principal);

        verify(messagingTemplate, times(1)).convertAndSend(
                eq("/topic/conversation/conv-456/typing"),
                argThat((Map<String, Object> payload) ->
                        payload.get("typing").equals(true) && payload.get("userId").equals(SENDER_ID))
        );
    }
}
