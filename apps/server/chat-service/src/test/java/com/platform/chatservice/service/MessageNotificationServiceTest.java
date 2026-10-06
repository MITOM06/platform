package com.platform.chatservice.service;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.model.AiPersona;
import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.AiPersonaRepository;
import com.platform.chatservice.repository.ExternalBotRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MessageNotificationServiceTest {

  private static final String SENDER = "user-1";
  private static final String RECIPIENT = "user-2";
  private static final String CONV = "conv-1";

  @Mock private ConversationQueryService conversationQueryService;
  @Mock private MessageQueryService messageQueryService;
  @Mock private ClusterMessageBroker clusterBroker;
  @Mock private FcmService fcmService;
  @Mock private ExternalBotRepository externalBotRepository;
  @Mock private AiPersonaRepository aiPersonaRepository;

  private MessageNotificationService service() {
    return service(SENDER);
  }

  private MessageNotificationService service(String sender) {
    when(conversationQueryService.getParticipants(CONV)).thenReturn(List.of(sender, RECIPIENT));
    when(messageQueryService.resolveDisplayName(SENDER)).thenReturn("Alice");
    return new MessageNotificationService(
        conversationQueryService,
        messageQueryService,
        clusterBroker,
        fcmService,
        externalBotRepository,
        aiPersonaRepository);
  }

  private MessageResponse message(String content, String type, List<String> mentions) {
    return message(SENDER, content, type, mentions);
  }

  private MessageResponse message(
      String sender, String content, String type, List<String> mentions) {
    return new MessageResponse(
        "msg-1",
        CONV,
        sender,
        content,
        type,
        List.of(SENDER),
        Instant.now(),
        null,
        null,
        List.of(),
        false,
        null,
        mentions);
  }

  @Test
  @SuppressWarnings("unchecked")
  void textMessage_notifiesEveryOtherParticipant_andPushes() {
    service().notifyNewMessage(SENDER, message("Hello", "text", List.of()));

    verify(clusterBroker, timeout(1000))
        .convertAndSendToUser(
            eq(RECIPIENT),
            eq("/queue/notifications"),
            argThat(
                payload ->
                    "NEW_MESSAGE".equals(((Map<String, String>) payload).get("type"))
                        && "Alice".equals(((Map<String, String>) payload).get("senderName"))
                        && "Hello".equals(((Map<String, String>) payload).get("content"))
                        // The list row can be updated in place from the event alone.
                        && "msg-1".equals(((Map<String, String>) payload).get("messageId"))
                        && !((Map<String, String>) payload).get("createdAt").isEmpty()));
    verify(fcmService, timeout(1000))
        .sendPushNotification(eq(RECIPIENT), eq("Alice"), eq("Hello"), eq(CONV));
    // The sender must never be self-notified.
    verify(clusterBroker, after(300).never())
        .convertAndSendToUser(eq(SENDER), eq("/queue/notifications"), any());
  }

  @Test
  @SuppressWarnings("unchecked")
  void mentionedParticipant_getsMentionedYouEvent() {
    service().notifyNewMessage(SENDER, message("hi @you", "text", List.of(RECIPIENT)));

    verify(clusterBroker, timeout(1000))
        .convertAndSendToUser(
            eq(RECIPIENT),
            eq("/queue/notifications"),
            argThat(
                payload -> "MENTIONED_YOU".equals(((Map<String, String>) payload).get("type"))));
  }

  @Test
  void mutedConversation_stillSendsEvent_butNoPush() {
    when(conversationQueryService.isMuted(CONV, RECIPIENT)).thenReturn(true);

    service().notifyNewMessage(SENDER, message("Hello", "text", List.of()));

    verify(clusterBroker, timeout(1000))
        .convertAndSendToUser(eq(RECIPIENT), eq("/queue/notifications"), any());
    verify(fcmService, after(300).never()).sendPushNotification(any(), any(), any(), any());
  }

  @Test
  void attachmentMessage_neverLeaksJsonPayloadIntoPushBody() {
    service()
        .notifyNewMessage(
            SENDER, message("{\"url\":\"/api/uploads/abc\",\"name\":\"cat.png\"}", "image", null));

    verify(fcmService, timeout(1000))
        .sendPushNotification(eq(RECIPIENT), eq("Alice"), eq("[Photo]"), eq(CONV));
  }

  @Test
  @SuppressWarnings("unchecked")
  void aiReply_isNamedAfterTheConversationPersona_neverTheBotId() {
    when(aiPersonaRepository.findByConversationId(CONV))
        .thenReturn(Optional.of(AiPersona.builder().conversationId(CONV).name("Mimi").build()));

    service(AiConstants.AI_BOT_USER_ID)
        .notifyNewMessage(
            AiConstants.AI_BOT_USER_ID,
            message(AiConstants.AI_BOT_USER_ID, "Here you go", "ai", null));

    verify(clusterBroker, timeout(1000))
        .convertAndSendToUser(
            eq(RECIPIENT),
            eq("/queue/notifications"),
            argThat(
                payload ->
                    "Mimi".equals(((Map<String, String>) payload).get("senderName"))
                        && "Here you go".equals(((Map<String, String>) payload).get("content"))));
    verify(fcmService, timeout(1000))
        .sendPushNotification(eq(RECIPIENT), eq("Mimi"), eq("Here you go"), eq(CONV));
  }

  @Test
  @SuppressWarnings("unchecked")
  void aiReply_withoutPersona_usesTheDefaultAssistantName() {
    when(aiPersonaRepository.findByConversationId(CONV)).thenReturn(Optional.empty());

    service(AiConstants.AI_BOT_USER_ID)
        .notifyNewMessage(
            AiConstants.AI_BOT_USER_ID, message(AiConstants.AI_BOT_USER_ID, "Hi", "ai", null));

    verify(clusterBroker, timeout(1000))
        .convertAndSendToUser(
            eq(RECIPIENT),
            eq("/queue/notifications"),
            argThat(payload -> "PON AI".equals(((Map<String, String>) payload).get("senderName"))));
  }

  @Test
  @SuppressWarnings("unchecked")
  void personalAssistantReply_isNamedAfterTheBot_neverTheExtbotId() {
    String botId = "extbot:bf-1";
    when(externalBotRepository.findByBotUserId(botId))
        .thenReturn(Optional.of(ExternalBot.builder().botUserId(botId).name("Jarvis").build()));

    service(botId).notifyNewMessage(botId, message(botId, "Done", "ai", null));

    verify(clusterBroker, timeout(1000))
        .convertAndSendToUser(
            eq(RECIPIENT),
            eq("/queue/notifications"),
            argThat(payload -> "Jarvis".equals(((Map<String, String>) payload).get("senderName"))));
    verify(fcmService, timeout(1000))
        .sendPushNotification(eq(RECIPIENT), eq("Jarvis"), eq("Done"), eq(CONV));
  }

  @Test
  @SuppressWarnings("unchecked")
  void longAiReply_isCutToAPreview() {
    when(aiPersonaRepository.findByConversationId(CONV)).thenReturn(Optional.empty());
    String longReply = "x".repeat(5000);

    service(AiConstants.AI_BOT_USER_ID)
        .notifyNewMessage(
            AiConstants.AI_BOT_USER_ID, message(AiConstants.AI_BOT_USER_ID, longReply, "ai", null));

    verify(clusterBroker, timeout(1000))
        .convertAndSendToUser(
            eq(RECIPIENT),
            eq("/queue/notifications"),
            argThat(
                payload -> {
                  String content = ((Map<String, String>) payload).get("content");
                  return content.length() <= 201 && content.endsWith("…");
                }));
    verify(fcmService, timeout(1000))
        .sendPushNotification(
            eq(RECIPIENT), eq("PON AI"), argThat(body -> body.length() <= 201), eq(CONV));
  }

  @Test
  void unresolvableSender_getsAGenericPushTitle_notTheirId() {
    when(messageQueryService.resolveDisplayName(SENDER)).thenReturn(SENDER);
    MessageNotificationService svc =
        new MessageNotificationService(
            conversationQueryService,
            messageQueryService,
            clusterBroker,
            fcmService,
            externalBotRepository,
            aiPersonaRepository);
    when(conversationQueryService.getParticipants(CONV)).thenReturn(List.of(SENDER, RECIPIENT));

    svc.notifyNewMessage(SENDER, message("Hello", "text", List.of()));

    verify(fcmService, timeout(1000))
        .sendPushNotification(eq(RECIPIENT), eq("New message"), eq("Hello"), eq(CONV));
  }
}
