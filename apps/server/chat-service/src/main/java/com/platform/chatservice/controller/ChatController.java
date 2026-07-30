package com.platform.chatservice.controller;

import com.platform.chatservice.dto.AiHistoryEntry;
import com.platform.chatservice.dto.ChatMessageDto;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.exception.RateLimitExceededException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.AiRedisPublisher;
import com.platform.chatservice.service.CallService;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.ExternalBotService;
import com.platform.chatservice.service.MessageNotificationService;
import com.platform.chatservice.service.MessageQueryService;
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
import org.springframework.stereotype.Controller;

@SuppressWarnings("null")
@Controller
@RequiredArgsConstructor
public class ChatController {

  private static final Pattern AI_MENTION_PATTERN = Pattern.compile("(?i)@(AI|ponai)\\b");

  private final MessageService messageService;
  private final MessageQueryService messageQueryService;
  private final ClusterMessageBroker clusterBroker;
  private final MessageNotificationService messageNotificationService;
  private final RateLimiterService rateLimiterService;
  private final AiRedisPublisher aiRedisPublisher;
  private final CallService callService;
  private final ExternalBotService externalBotService;
  private final ConversationService conversationService;

  @MessageMapping("/chat.send")
  public void send(@Payload ChatMessageDto dto, Principal principal) {
    try {
      rateLimiterService.checkMessageRate(principal.getName());
    } catch (RateLimitExceededException e) {
      // STOMP has no HTTP status — send an error event to the user's private queue.
      clusterBroker.convertAndSendToUser(
          principal.getName(),
          "/queue/notifications",
          Map.of("type", "RATE_LIMITED", "message", e.getMessage()));
      return;
    }

    SendMessageRequest request =
        new SendMessageRequest(
            dto.getConversationId(), dto.getContent(), dto.getType(), dto.getReplyToId());
    MessageResponse response = messageService.sendMessage(principal.getName(), request);
    clusterBroker.convertAndSend("/topic/conversation/" + dto.getConversationId(), response);

    // Async AI trigger — must not block the STOMP response.
    // Trigger when the message mentions @AI, OR when this is a 1-1 conversation with the native AI
    // bot (every message there is implicitly addressed to the AI, so no mention is required).
    boolean hasMention =
        dto.getContent() != null && AI_MENTION_PATTERN.matcher(dto.getContent()).find();
    boolean isDirectAi =
        dto.getContent() != null
            && conversationService.isDirectAiConversation(dto.getConversationId());
    if (hasMention || isDirectAi) {
      final String uid = principal.getName();
      final String convId = dto.getConversationId();
      final String raw = dto.getContent();
      // Forward the caller's RBAC claims (P2a) so ai-service can role-filter the
      // org-context block. Legacy/unauthenticated principals yield null/empty.
      final String role = principal instanceof UserPrincipal up ? up.getRole() : null;
      final List<String> perms = principal instanceof UserPrincipal up ? up.getPerms() : List.of();
      final List<String> depts = principal instanceof UserPrincipal up ? up.getDepts() : List.of();
      CompletableFuture.runAsync(
          () -> {
            try {
              List<AiHistoryEntry> history = messageQueryService.getAiHistory(uid, convId);
              String stripped = raw.replaceAll("(?i)@(AI|ponai)\\b", "").trim();
              String displayName = messageQueryService.resolveDisplayName(uid);
              aiRedisPublisher.publishAiRequest(
                  convId, uid, displayName, stripped, history, role, perms, depts);
            } catch (Exception ignored) {
            }
          });
    }

    // Async personal-assistant (Bot Factory) trigger — 1-1 conversation with the member's bot.
    if (dto.getContent() != null) {
      final String botUid = principal.getName();
      final String botConvId = dto.getConversationId();
      final String botRaw = dto.getContent();
      externalBotService
          .resolveAssistant(botConvId, botUid)
          .ifPresent(
              bot ->
                  CompletableFuture.runAsync(
                      () -> {
                        try {
                          externalBotService.reply(bot, botConvId, botRaw);
                        } catch (Exception ignored) {
                        }
                      }));
    }

    messageNotificationService.notifyNewMessage(principal.getName(), response);
  }

  @MessageMapping("/chat.typing")
  public void typing(@Payload ChatMessageDto dto, Principal principal) {
    Map<String, Object> payload =
        Map.of(
            "conversationId", dto.getConversationId(),
            "userId", principal.getName(),
            "typing", Boolean.TRUE.equals(dto.getTyping()));
    clusterBroker.convertAndSend(
        "/topic/conversation/" + dto.getConversationId() + "/typing", payload);
  }

  @MessageMapping("/chat.read")
  public void markRead(@Payload ChatMessageDto dto, Principal principal) {
    // markAsRead enforces participant membership and returns the message's real conversationId.
    String actualConversationId =
        messageService.markAsRead(principal.getName(), dto.getMessageId());
    // Only broadcast if the client-supplied conversationId matches the message's actual one, so a
    // spoofed conversationId can't fan a MESSAGE_READ event into an unrelated conversation.
    if (!actualConversationId.equals(dto.getConversationId())) {
      return;
    }
    Map<String, String> event =
        Map.of(
            "type", "MESSAGE_READ",
            "messageId", dto.getMessageId(),
            "readerId", principal.getName());
    clusterBroker.convertAndSend("/topic/conversation/" + actualConversationId, event);
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
    clusterBroker.convertAndSendToUser(dto.getTargetId(), "/queue/webrtc", dto);
  }

  @MessageMapping("/call.end")
  public void callEnd(
      @Payload com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
    dto.setSenderId(principal.getName());
    // Notify the other peer
    clusterBroker.convertAndSendToUser(dto.getTargetId(), "/queue/webrtc", dto);

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
    clusterBroker.convertAndSend("/topic/conversation/" + dto.getConversationId(), response);
  }
}
