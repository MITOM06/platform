package com.platform.chatservice.controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.EditMessageRequest;
import com.platform.chatservice.dto.ForwardMessageRequest;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.ReactionRequest;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.AiFeedbackService;
import com.platform.chatservice.service.AiRedisPublisher;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.ConversationEventPublisher;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.ExternalBotService;
import com.platform.chatservice.service.MessageInteractionService;
import com.platform.chatservice.service.MessageNotificationService;
import com.platform.chatservice.service.MessageQueryService;
import com.platform.chatservice.service.MessageService;
import com.platform.chatservice.service.RateLimiterService;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class MessageControllerTest {

  @Mock private MessageService messageService;
  @Mock private MessageQueryService messageQueryService;
  @Mock private MessageNotificationService messageNotificationService;
  @Mock private ClusterMessageBroker clusterBroker;
  @Mock private RateLimiterService rateLimiterService;
  @Mock private AiRedisPublisher aiRedisPublisher;
  @Mock private AiFeedbackService aiFeedbackService;
  @Mock private ExternalBotService externalBotService;
  @Mock private ConversationService conversationService;
  @Mock private MessageInteractionService interactionService;
  @Mock private ConversationEventPublisher conversationEvents;

  @InjectMocks private MessageController messageController;

  private static final String SENDER_ID = "user-123";

  @BeforeEach
  void setUp() {
    SecurityContextHolder.getContext().setAuthentication(new UserPrincipal(SENDER_ID));
  }

  @AfterEach
  void tearDown() {
    SecurityContextHolder.clearContext();
  }

  private MessageResponse response(String content) {
    return new MessageResponse(
        "msg-1", "conv-456", SENDER_ID, content, "text", List.of(SENDER_ID), Instant.now());
  }

  @Test
  void sendMessage_InDirectAiConversation_WithoutMention_ShouldTriggerAiPublisher()
      throws Exception {
    SendMessageRequest request = new SendMessageRequest("conv-456", "chào bạn", "text", null);
    when(messageService.sendMessage(eq(SENDER_ID), any(SendMessageRequest.class)))
        .thenReturn(response("chào bạn"));
    when(conversationService.isDirectAiConversation("conv-456")).thenReturn(true);
    when(externalBotService.resolveAssistant(eq("conv-456"), eq(SENDER_ID)))
        .thenReturn(Optional.empty());
    when(messageQueryService.getAiHistory(eq(SENDER_ID), eq("conv-456"))).thenReturn(List.of());
    when(messageQueryService.resolveDisplayName(SENDER_ID)).thenReturn("Alice");

    messageController.sendMessage(request);

    Thread.sleep(100);
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

  @Test
  void sendMessage_InGroup_WithoutMention_ShouldNotTriggerAiPublisher() throws Exception {
    SendMessageRequest request =
        new SendMessageRequest("conv-456", "Hello everyone!", "text", null);
    when(messageService.sendMessage(eq(SENDER_ID), any(SendMessageRequest.class)))
        .thenReturn(response("Hello everyone!"));
    when(conversationService.isDirectAiConversation("conv-456")).thenReturn(false);
    when(externalBotService.resolveAssistant(eq("conv-456"), eq(SENDER_ID)))
        .thenReturn(Optional.empty());

    messageController.sendMessage(request);

    Thread.sleep(100);
    verify(aiRedisPublisher, never())
        .publishAiRequest(any(), any(), any(), any(), any(), any(), any(), any());
  }

  @Test
  void sendMessage_StickerInDirectAiConversation_ShouldNotTriggerAnyAssistant() throws Exception {
    SendMessageRequest request = new SendMessageRequest("conv-456", "sticker-url", "sticker", null);
    MessageResponse sticker =
        new MessageResponse(
            "msg-2",
            "conv-456",
            SENDER_ID,
            "sticker-url",
            "sticker",
            List.of(SENDER_ID),
            Instant.now());
    when(messageService.sendMessage(eq(SENDER_ID), any(SendMessageRequest.class)))
        .thenReturn(sticker);

    messageController.sendMessage(request);

    Thread.sleep(100);
    verify(aiRedisPublisher, never())
        .publishAiRequest(any(), any(), any(), any(), any(), any(), any(), any());
    verify(conversationService, never()).isDirectAiConversation(any());
    verify(externalBotService, never()).resolveAssistant(any(), any());
  }

  /** Recalling the newest message refreshes every member's conversation list (shared update). */
  @Test
  void recall_OfNewestMessage_PublishesSharedConversationUpdate() {
    MessageResponse recalled = response("");
    when(messageService.recallMessage(SENDER_ID, "msg-1"))
        .thenReturn(new MessageService.MessageChange(recalled, true));

    messageController.recall("msg-1");

    verify(clusterBroker).convertAndSend(eq("/topic/conversation/conv-456"), any(Object.class));
    verify(conversationEvents).publishShared("conv-456");
  }

  @Test
  void recall_OfOlderMessage_DoesNotTouchTheConversationList() {
    when(messageService.recallMessage(SENDER_ID, "msg-1"))
        .thenReturn(new MessageService.MessageChange(response(""), false));

    messageController.recall("msg-1");

    verify(conversationEvents, never()).publishShared(anyString());
  }

  @Test
  void edit_OfNewestMessage_PublishesSharedConversationUpdate() {
    MessageResponse edited =
        new MessageResponse(
            "msg-1",
            "conv-456",
            SENDER_ID,
            "edited",
            "text",
            List.of(SENDER_ID),
            Instant.now(),
            null,
            null,
            List.of(),
            false,
            Instant.now(),
            List.of());
    when(messageService.editMessage(SENDER_ID, "msg-1", "edited"))
        .thenReturn(new MessageService.MessageChange(edited, true));

    messageController.editMessage("msg-1", new EditMessageRequest("edited"));

    verify(conversationEvents).publishShared("conv-456");
  }

  @Test
  void reactions_AreRateLimited() {
    when(interactionService.addReaction(SENDER_ID, "msg-1", "👍")).thenReturn(response("x"));
    when(interactionService.removeReaction(SENDER_ID, "msg-1")).thenReturn(response("x"));

    messageController.addReaction("msg-1", new ReactionRequest("👍"));
    messageController.removeReaction("msg-1");

    verify(rateLimiterService, times(2)).checkReactionRate(SENDER_ID);
  }

  @Test
  void forward_IsRateLimitedLikeASend() {
    when(messageService.forwardMessage(SENDER_ID, "msg-1", "conv-9")).thenReturn(response("hi"));

    messageController.forwardMessage("msg-1", new ForwardMessageRequest("conv-9"));

    verify(rateLimiterService).checkMessageRate(SENDER_ID);
  }

  @Test
  void forward_WhenRateLimited_DoesNotForward() {
    doThrow(new com.platform.chatservice.exception.RateLimitExceededException())
        .when(rateLimiterService)
        .checkMessageRate(SENDER_ID);

    org.assertj.core.api.Assertions.assertThatThrownBy(
            () -> messageController.forwardMessage("msg-1", new ForwardMessageRequest("conv-9")))
        .isInstanceOf(com.platform.chatservice.exception.RateLimitExceededException.class);
    verify(messageService, never()).forwardMessage(any(), any(), any());
  }
}
