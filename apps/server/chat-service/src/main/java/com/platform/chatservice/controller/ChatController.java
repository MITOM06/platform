package com.platform.chatservice.controller;

import com.platform.chatservice.dto.AiHistoryEntry;
import com.platform.chatservice.dto.ChatMessageDto;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.exception.RateLimitExceededException;
import com.platform.chatservice.service.AiRedisPublisher;
import com.platform.chatservice.service.CallService;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.MessageService;
import com.platform.chatservice.service.RateLimiterService;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@SuppressWarnings("null")
@Controller
@RequiredArgsConstructor
public class ChatController {

  private static final Pattern AI_MENTION_PATTERN = Pattern.compile("(?i)@(AI|ponai)\\b");

  private final MessageService messageService;
  private final ConversationService conversationService;
  private final SimpMessagingTemplate messagingTemplate;
  private final com.platform.chatservice.service.FcmService fcmService;
  private final RateLimiterService rateLimiterService;
  private final AiRedisPublisher aiRedisPublisher;
  private final CallService callService;

  @MessageMapping("/chat.send")
  public void send(@Payload ChatMessageDto dto, Principal principal) {
    try {
      rateLimiterService.checkMessageRate(principal.getName());
    } catch (RateLimitExceededException e) {
      // STOMP has no HTTP status — send an error event to the user's private queue.
      messagingTemplate.convertAndSendToUser(
          principal.getName(),
          "/queue/notifications",
          Map.of("type", "RATE_LIMITED", "message", e.getMessage()));
      return;
    }

    SendMessageRequest request =
        new SendMessageRequest(
            dto.getConversationId(), dto.getContent(), dto.getType(), dto.getReplyToId());
    MessageResponse response = messageService.sendMessage(principal.getName(), request);
    messagingTemplate.convertAndSend("/topic/conversation/" + dto.getConversationId(), response);

    // Async AI trigger — must not block the STOMP response
    if (dto.getContent() != null && AI_MENTION_PATTERN.matcher(dto.getContent()).find()) {
      final String uid = principal.getName();
      final String convId = dto.getConversationId();
      final String raw = dto.getContent();
      CompletableFuture.runAsync(
          () -> {
            try {
              List<AiHistoryEntry> history = messageService.getAiHistory(uid, convId);
              String stripped = raw.replaceAll("(?i)@(AI|ponai)\\b", "").trim();
              aiRedisPublisher.publishAiRequest(convId, uid, uid, stripped, history);
            } catch (Exception ignored) {
            }
          });
    }

    List<String> mentions = response.mentions() == null ? List.of() : response.mentions();
    List<String> participants = conversationService.getParticipants(dto.getConversationId());
    for (String participantId : participants) {
      if (!participantId.equals(principal.getName())) {
        boolean muted = conversationService.isMuted(dto.getConversationId(), participantId);
        // Mentioned participants get a priority MENTIONED_YOU event instead
        // of the generic NEW_MESSAGE so the client can surface it specially.
        boolean mentioned = mentions.contains(participantId);
        // senderName carries the sender's userId; the client resolves it
        // to a display name. senderId is sent explicitly for clarity.
        Map<String, String> notification =
            Map.of(
                "type",
                mentioned ? "MENTIONED_YOU" : "NEW_MESSAGE",
                "conversationId",
                dto.getConversationId(),
                "senderId",
                principal.getName(),
                "senderName",
                principal.getName(),
                "content",
                dto.getContent() != null ? dto.getContent() : "",
                "messageType",
                dto.getType() != null ? dto.getType() : "text");
        messagingTemplate.convertAndSendToUser(participantId, "/queue/notifications", notification);

        // Trigger Push Notification only if the conversation is not muted for this user
        if (!muted) {
          fcmService.sendPushNotification(
              participantId, principal.getName(), dto.getContent(), dto.getConversationId());
        }
      }
    }
  }

  @MessageMapping("/chat.typing")
  public void typing(@Payload ChatMessageDto dto, Principal principal) {
    Map<String, Object> payload =
        Map.of(
            "conversationId", dto.getConversationId(),
            "userId", principal.getName(),
            "typing", Boolean.TRUE.equals(dto.getTyping()));
    messagingTemplate.convertAndSend(
        "/topic/conversation/" + dto.getConversationId() + "/typing", payload);
  }

  @MessageMapping("/chat.read")
  public void markRead(@Payload ChatMessageDto dto, Principal principal) {
    messageService.markAsRead(principal.getName(), dto.getMessageId());
    Map<String, String> event =
        Map.of(
            "type", "MESSAGE_READ",
            "messageId", dto.getMessageId(),
            "readerId", principal.getName());
    messagingTemplate.convertAndSend("/topic/conversation/" + dto.getConversationId(), event);
  }

  // WebRTC Signaling Endpoints.
  // Shared by the legacy 1-on-1 flow and the group mesh: when the payload carries a callId the
  // signal is a group-mesh relay (delegated to CallService, which stamps fromId), otherwise it
  // keeps the original 1-on-1 relay behavior.
  @MessageMapping("/call.offer")
  public void callOffer(
      @Payload com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
    relayCallSignal("offer", dto, principal);
  }

  @MessageMapping("/call.answer")
  public void callAnswer(
      @Payload com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
    relayCallSignal("answer", dto, principal);
  }

  @MessageMapping("/call.ice")
  public void callIceCandidate(
      @Payload com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
    relayCallSignal("ice", dto, principal);
  }

  private void relayCallSignal(
      String type, com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
    if (dto.getCallId() != null && !dto.getCallId().isBlank()) {
      // Group mesh signaling.
      callService.relaySignal(principal.getName(), type, dto);
      return;
    }
    // Legacy 1-on-1 relay (unchanged).
    dto.setSenderId(principal.getName());
    messagingTemplate.convertAndSendToUser(dto.getTargetId(), "/queue/webrtc", dto);
  }

  @MessageMapping("/call.end")
  public void callEnd(
      @Payload com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
    dto.setSenderId(principal.getName());
    // Notify the other peer
    messagingTemplate.convertAndSendToUser(dto.getTargetId(), "/queue/webrtc", dto);

    // Save call log
    String content = "Call ended";
    if (dto.getDuration() != null && dto.getDuration() > 0) {
      int minutes = dto.getDuration() / 60;
      int seconds = dto.getDuration() % 60;
      content = String.format("Call ended - %02d:%02d", minutes, seconds);
    } else {
      content = "Missed call";
    }

    SendMessageRequest logRequest =
        new SendMessageRequest(dto.getConversationId(), content, "call_log", null);
    MessageResponse response = messageService.sendMessage(principal.getName(), logRequest);
    messagingTemplate.convertAndSend("/topic/conversation/" + dto.getConversationId(), response);
  }
}
