package com.platform.chatservice.controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.ChatMessageDto;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.service.AiRedisPublisher;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.ExternalBotService;
import com.platform.chatservice.service.MessageService;
import com.platform.chatservice.service.RateLimiterService;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class ChatControllerTest {

  @Mock private MessageService messageService;

  @Mock private ConversationService conversationService;

  @Mock private SimpMessagingTemplate messagingTemplate;

  @Mock private Principal principal;

  @Mock private com.platform.chatservice.service.FcmService fcmService;

  @Mock private RateLimiterService rateLimiterService;

  @Mock private AiRedisPublisher aiRedisPublisher;

  @Mock private ExternalBotService externalBotService;

  @InjectMocks private ChatController chatController;

  private ChatMessageDto chatDto;
  private final String SENDER_ID = "user-123";

  @BeforeEach
  void setUp() {
    chatDto = new ChatMessageDto("conv-456", "Hello", "text", false, null, null);
    when(principal.getName()).thenReturn(SENDER_ID);
  }

  @Test
  void send_ShouldSendMessageAndBroadcast() {
    MessageResponse response =
        new MessageResponse(
            "msg-999", "conv-456", SENDER_ID, "Hello", "text", List.of(SENDER_ID), Instant.now());

    when(conversationService.getParticipants("conv-456"))
        .thenReturn(List.of(SENDER_ID, "user-456"));
    when(messageService.sendMessage(eq(SENDER_ID), any(SendMessageRequest.class)))
        .thenReturn(response);

    chatController.send(chatDto, principal);

    verify(messageService, times(1)).sendMessage(eq(SENDER_ID), any(SendMessageRequest.class));
    verify(messagingTemplate, times(1))
        .convertAndSend(eq("/topic/conversation/conv-456"), eq(response));
    verify(messagingTemplate, times(1))
        .convertAndSendToUser(eq("user-456"), eq("/queue/notifications"), any(Map.class));
    verify(fcmService, times(1))
        .sendPushNotification(eq("user-456"), eq(SENDER_ID), eq("Hello"), eq("conv-456"));
  }

  @Test
  void typing_ShouldBroadcastTypingStatus() {
    chatDto.setTyping(true);

    chatController.typing(chatDto, principal);

    verify(messagingTemplate, times(1))
        .convertAndSend(
            eq("/topic/conversation/conv-456/typing"),
            argThat(
                (Map<String, Object> payload) ->
                    payload.get("typing").equals(true) && payload.get("userId").equals(SENDER_ID)));
  }

  @Test
  void callOffer_ShouldRouteToTarget() {
    com.platform.chatservice.dto.WebRTCSignalDto dto =
        new com.platform.chatservice.dto.WebRTCSignalDto();
    dto.setTargetId("user-789");
    dto.setType("offer");

    chatController.callOffer(dto, principal);

    verify(messagingTemplate, times(1))
        .convertAndSendToUser(eq("user-789"), eq("/queue/webrtc"), eq(dto));
  }

  @Test
  void send_WithAtAI_ShouldTriggerAiPublisher() throws Exception {
    ChatMessageDto aiDto =
        new ChatMessageDto("conv-456", "@AI what is Flutter?", "text", false, null, null);
    MessageResponse response =
        new MessageResponse(
            "msg-1",
            "conv-456",
            SENDER_ID,
            "@AI what is Flutter?",
            "text",
            List.of(SENDER_ID),
            Instant.now());

    when(conversationService.getParticipants("conv-456"))
        .thenReturn(List.of(SENDER_ID, "user-456"));
    when(messageService.sendMessage(eq(SENDER_ID), any(SendMessageRequest.class)))
        .thenReturn(response);
    when(messageService.getAiHistory(eq(SENDER_ID), eq("conv-456"))).thenReturn(List.of());
    when(messageService.resolveDisplayName(SENDER_ID)).thenReturn("Alice");

    chatController.send(aiDto, principal);

    // Give the CompletableFuture time to run
    Thread.sleep(100);
    // displayName (3rd arg) must be the resolved human name, not the raw userId.
    verify(aiRedisPublisher, times(1))
        .publishAiRequest(
            eq("conv-456"),
            eq(SENDER_ID),
            eq("Alice"),
            argThat(s -> !s.contains("@AI")),
            anyList());
  }

  @Test
  void send_WithoutAtAI_ShouldNotTriggerAiPublisher() throws Exception {
    ChatMessageDto dto =
        new ChatMessageDto("conv-456", "Hello everyone!", "text", false, null, null);
    MessageResponse response =
        new MessageResponse(
            "msg-2",
            "conv-456",
            SENDER_ID,
            "Hello everyone!",
            "text",
            List.of(SENDER_ID),
            Instant.now());

    when(conversationService.getParticipants("conv-456"))
        .thenReturn(List.of(SENDER_ID, "user-456"));
    when(messageService.sendMessage(eq(SENDER_ID), any(SendMessageRequest.class)))
        .thenReturn(response);

    chatController.send(dto, principal);

    Thread.sleep(100);
    verify(aiRedisPublisher, never()).publishAiRequest(any(), any(), any(), any(), any());
  }

  @Test
  void callEnd_ShouldSaveCallLog() {
    com.platform.chatservice.dto.WebRTCSignalDto dto =
        new com.platform.chatservice.dto.WebRTCSignalDto();
    dto.setTargetId("user-789");
    dto.setConversationId("conv-999");
    dto.setType("end");
    dto.setDuration(125); // 02:05

    MessageResponse mockResponse =
        new MessageResponse(
            "msg-1",
            "conv-999",
            SENDER_ID,
            "Call ended - 02:05",
            "call_log",
            List.of(SENDER_ID),
            Instant.now());
    when(messageService.sendMessage(eq(SENDER_ID), any(SendMessageRequest.class)))
        .thenReturn(mockResponse);

    chatController.callEnd(dto, principal);

    verify(messagingTemplate, times(1))
        .convertAndSendToUser(eq("user-789"), eq("/queue/webrtc"), eq(dto));

    verify(messageService, times(1))
        .sendMessage(
            eq(SENDER_ID),
            argThat(
                req ->
                    req.content().equals("Call ended - 02:05") && req.type().equals("call_log")));

    verify(messagingTemplate, times(1))
        .convertAndSend(eq("/topic/conversation/conv-999"), eq(mockResponse));
  }
}
