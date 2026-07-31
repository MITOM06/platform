package com.platform.chatservice.controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.ChatMessageDto;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.service.AiRedisPublisher;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.ExternalBotService;
import com.platform.chatservice.service.MessageNotificationService;
import com.platform.chatservice.service.MessageQueryService;
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

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class ChatControllerTest {

  @Mock private MessageService messageService;

  @Mock private MessageQueryService messageQueryService;

  @Mock private ClusterMessageBroker clusterBroker;

  @Mock private Principal principal;

  @Mock private MessageNotificationService messageNotificationService;

  @Mock private RateLimiterService rateLimiterService;

  @Mock private AiRedisPublisher aiRedisPublisher;

  @Mock private ExternalBotService externalBotService;

  @Mock private ConversationService conversationService;

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

    when(messageService.sendMessage(eq(SENDER_ID), any(SendMessageRequest.class)))
        .thenReturn(response);

    chatController.send(chatDto, principal);

    verify(messageService, times(1)).sendMessage(eq(SENDER_ID), any(SendMessageRequest.class));
    verify(clusterBroker, times(1))
        .convertAndSend(eq("/topic/conversation/conv-456"), eq(response));
    verify(messageNotificationService, times(1)).notifyNewMessage(eq(SENDER_ID), eq(response));
  }

  @Test
  void typing_ShouldBroadcastTypingStatus() {
    chatDto.setTyping(true);

    chatController.typing(chatDto, principal);

    verify(clusterBroker, times(1))
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

    verify(clusterBroker, times(1))
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

    when(messageService.sendMessage(eq(SENDER_ID), any(SendMessageRequest.class)))
        .thenReturn(response);
    when(messageQueryService.getAiHistory(eq(SENDER_ID), eq("conv-456"))).thenReturn(List.of());
    when(messageQueryService.resolveDisplayName(SENDER_ID)).thenReturn("Alice");

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
            anyList(),
            any(),
            anyList(),
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

    when(messageService.sendMessage(eq(SENDER_ID), any(SendMessageRequest.class)))
        .thenReturn(response);

    chatController.send(dto, principal);

    Thread.sleep(100);
    verify(aiRedisPublisher, never())
        .publishAiRequest(any(), any(), any(), any(), any(), any(), any(), any());
  }

  @Test
  void send_InDirectAiConversation_WithoutMention_ShouldTriggerAiPublisher() throws Exception {
    // 1-1 with the native AI bot: a plain message with no "@AI" must still trigger the AI.
    ChatMessageDto dto = new ChatMessageDto("conv-456", "chào bạn", "text", false, null, null);
    MessageResponse response =
        new MessageResponse(
            "msg-3", "conv-456", SENDER_ID, "chào bạn", "text", List.of(SENDER_ID), Instant.now());

    when(messageService.sendMessage(eq(SENDER_ID), any(SendMessageRequest.class)))
        .thenReturn(response);
    when(conversationService.isDirectAiConversation("conv-456")).thenReturn(true);
    when(messageQueryService.getAiHistory(eq(SENDER_ID), eq("conv-456"))).thenReturn(List.of());
    when(messageQueryService.resolveDisplayName(SENDER_ID)).thenReturn("Alice");

    chatController.send(dto, principal);

    Thread.sleep(100);
    // The full message is forwarded verbatim (nothing to strip when there is no mention).
    verify(aiRedisPublisher, times(1))
        .publishAiRequest(
            eq("conv-456"),
            eq(SENDER_ID),
            eq("Alice"),
            eq("chào bạn"),
            anyList(),
            any(),
            anyList(),
            anyList());
  }

  /**
   * The hang-up must reach the other peer — that is this handler's only job.
   *
   * <p>It must NOT also persist a call-log message. The clients send the coded, localizable {@code
   * system.call.ended:{kind}:{secs}} themselves; a server-side {@code call_log} on top of that
   * produced a second history entry whose content was hardcoded English.
   */
  @Test
  void callEnd_ShouldRelayToPeer_AndNotPersistAnyMessage() {
    com.platform.chatservice.dto.WebRTCSignalDto dto =
        new com.platform.chatservice.dto.WebRTCSignalDto();
    dto.setTargetId("user-789");
    dto.setConversationId("conv-999");
    dto.setType("end");
    dto.setDuration(125); // 02:05

    chatController.callEnd(dto, principal);

    verify(clusterBroker, times(1))
        .convertAndSendToUser(eq("user-789"), eq("/queue/webrtc"), eq(dto));

    // No message is written, so nothing English-only lands in the history and the
    // conversation gets exactly one entry (the client's localized system message).
    verify(messageService, never()).sendMessage(anyString(), any(SendMessageRequest.class));
    verify(clusterBroker, never()).convertAndSend(startsWith("/topic/conversation/"), any());
  }

  /** A missed call (no duration) likewise persists nothing. */
  @Test
  void callEnd_WithNoDuration_StillPersistsNothing() {
    com.platform.chatservice.dto.WebRTCSignalDto dto =
        new com.platform.chatservice.dto.WebRTCSignalDto();
    dto.setTargetId("user-789");
    dto.setConversationId("conv-999");
    dto.setType("end");

    chatController.callEnd(dto, principal);

    verify(clusterBroker, times(1))
        .convertAndSendToUser(eq("user-789"), eq("/queue/webrtc"), eq(dto));
    verify(messageService, never()).sendMessage(anyString(), any(SendMessageRequest.class));
  }
}
