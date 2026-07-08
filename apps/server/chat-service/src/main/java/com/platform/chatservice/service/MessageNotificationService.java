package com.platform.chatservice.service;

import com.platform.chatservice.dto.MessageResponse;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Fans a newly persisted message out to every other participant: a {@code NEW_MESSAGE} / {@code
 * MENTIONED_YOU} event on {@code /user/queue/notifications} (drives in-app banners, unread badges
 * and conversation-list updates on both clients) plus an FCM push for offline devices.
 *
 * <p>This MUST be invoked from every user-facing send path — STOMP {@code /app/chat.send}, REST
 * {@code POST /api/messages} and message forwarding — otherwise recipients whose app is
 * backgrounded (or who are viewing another screen) never learn about the message until a manual
 * reload. Historically only the STOMP path notified, so any message sent over REST (all web sends,
 * attachments, and the mobile REST fallback) was silent. That was the root cause of "no realtime
 * notification" reports.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MessageNotificationService {

  private final ConversationQueryService conversationQueryService;
  private final MessageQueryService messageQueryService;
  private final ClusterMessageBroker clusterBroker;
  private final FcmService fcmService;

  /**
   * Notify all participants except the sender. Runs asynchronously — callers on the hot send path
   * must never block on (or fail because of) notification fan-out.
   */
  public void notifyNewMessage(String senderId, MessageResponse response) {
    CompletableFuture.runAsync(
        () -> {
          try {
            fanOut(senderId, response);
          } catch (Exception e) {
            log.error(
                "Notification fan-out failed for message {} in conversation {}",
                response.id(),
                response.conversationId(),
                e);
          }
        });
  }

  private void fanOut(String senderId, MessageResponse response) {
    String conversationId = response.conversationId();
    List<String> mentions = response.mentions() == null ? List.of() : response.mentions();
    List<String> participants = conversationQueryService.getParticipants(conversationId);
    // Resolve the sender's human-readable name once (same for every recipient).
    // Clients display senderName directly, so it must never be a bare userId.
    String senderDisplayName = messageQueryService.resolveDisplayName(senderId);
    String content = response.content() != null ? response.content() : "";
    String type = response.type() != null ? response.type() : "text";
    String pushBody = pushBody(content, type);

    for (String participantId : participants) {
      if (participantId.equals(senderId)) {
        continue;
      }
      boolean muted = conversationQueryService.isMuted(conversationId, participantId);
      // Mentioned participants get a priority MENTIONED_YOU event instead of the generic
      // NEW_MESSAGE so the client can surface it specially. The event is sent even when the
      // conversation is muted — clients gate the banner but still update unread counts.
      boolean mentioned = mentions.contains(participantId);
      Map<String, String> notification =
          Map.of(
              "type", mentioned ? "MENTIONED_YOU" : "NEW_MESSAGE",
              "conversationId", conversationId,
              "senderId", senderId,
              "senderName", senderDisplayName,
              "content", content,
              "messageType", type);
      clusterBroker.convertAndSendToUser(participantId, "/queue/notifications", notification);

      if (!muted) {
        fcmService.sendPushNotification(participantId, senderId, pushBody, conversationId);
      }
    }
  }

  /**
   * Body shown on the OS notification (lock screen). Attachment messages store a JSON payload as
   * content — that must never reach a user-visible surface, so map non-text types to a generic
   * English label (localization is client-side; FCM notification messages are rendered by the OS
   * as-is).
   */
  private String pushBody(String content, String type) {
    return switch (type) {
      case "text", "ai" -> content;
      case "image" -> "[Photo]";
      case "video" -> "[Video]";
      case "voice" -> "[Voice message]";
      case "file" -> "[File]";
      case "sticker" -> "[Sticker]";
      default -> "New message";
    };
  }
}
