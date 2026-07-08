package com.platform.chatservice.service;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.MessageResponse;
import java.time.Instant;
import java.util.List;
import java.util.Map;
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

  private MessageNotificationService service() {
    when(conversationQueryService.getParticipants(CONV)).thenReturn(List.of(SENDER, RECIPIENT));
    when(messageQueryService.resolveDisplayName(SENDER)).thenReturn("Alice");
    return new MessageNotificationService(
        conversationQueryService, messageQueryService, clusterBroker, fcmService);
  }

  private MessageResponse message(String content, String type, List<String> mentions) {
    return new MessageResponse(
        "msg-1",
        CONV,
        SENDER,
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
                        && "Hello".equals(((Map<String, String>) payload).get("content"))));
    verify(fcmService, timeout(1000))
        .sendPushNotification(eq(RECIPIENT), eq(SENDER), eq("Hello"), eq(CONV));
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
        .sendPushNotification(eq(RECIPIENT), eq(SENDER), eq("[Photo]"), eq(CONV));
  }
}
