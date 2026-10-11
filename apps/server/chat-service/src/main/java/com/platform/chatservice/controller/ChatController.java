package com.platform.chatservice.controller;

import com.platform.chatservice.dto.AiHistoryEntry;
import com.platform.chatservice.dto.ChatMessageDto;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.exception.RateLimitExceededException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.AiRedisPublisher;
import com.platform.chatservice.service.CallSignalRelay;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.ConversationMembershipCache;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.ExternalBotService;
import com.platform.chatservice.service.MessageNotificationService;
import com.platform.chatservice.service.MessageQueryService;
import com.platform.chatservice.service.MessageService;
import com.platform.chatservice.service.MessageTypePolicy;
import com.platform.chatservice.service.RateLimiterService;
import java.security.Principal;
import java.util.HashMap;
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
  private final CallSignalRelay callSignalRelay;
  private final ExternalBotService externalBotService;
  private final ConversationService conversationService;
  private final ConversationMembershipCache membershipCache;

  @MessageMapping("/chat.send")
  public void send(@Payload ChatMessageDto dto, Principal principal) {
    try {
      rateLimiterService.checkMessageRate(principal.getName());
    } catch (RateLimitExceededException e) {
      // STOMP has no HTTP status — send the stable code (never exception text) to the user's
      // private queue; clients map it to a localized message.
      clusterBroker.convertAndSendToUser(
          principal.getName(), "/queue/notifications", Map.of("type", ErrorCodes.RATE_LIMITED));
      return;
    }

    SendMessageRequest request =
        new SendMessageRequest(
            dto.getConversationId(), dto.getContent(), dto.getType(), dto.getReplyToId());
    MessageResponse response;
    try {
      response = messageService.sendMessage(principal.getName(), request);
    } catch (BadRequestException
        | ForbiddenException
        | ConversationNotFoundException
        | IllegalArgumentException e) {
      // STOMP has no HTTP status: tell the sender (only) why the frame was refused.
      rejectSend(principal.getName(), dto.getConversationId(), e);
      return;
    }
    clusterBroker.convertAndSend("/topic/conversation/" + dto.getConversationId(), response);

    // Async AI trigger — must not block the STOMP response.
    // Trigger when the message mentions @AI, OR when this is a 1-1 conversation with the native AI
    // bot (every message there is implicitly addressed to the AI, so no mention is required). Only
    // TEXT does: stickers, voice notes, file JSON and system codes are not prompts.
    boolean isText =
        dto.getContent() != null && MessageTypePolicy.triggersAssistant(response.type());
    boolean hasMention = isText && AI_MENTION_PATTERN.matcher(dto.getContent()).find();
    boolean isDirectAi =
        isText && conversationService.isDirectAiConversation(dto.getConversationId());
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
    if (isText) {
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

  /**
   * {@code {type:"MESSAGE_REJECTED", conversationId, code}} on the sender's notification queue —
   * the STOMP counterpart of the REST 400/403/404 (code: see {@code ErrorCodes}; {@code NOT_FOUND}
   * for an unknown / non-member conversation).
   */
  private void rejectSend(String userId, String conversationId, RuntimeException e) {
    String code;
    if (e instanceof BadRequestException bad) {
      code = bad.getCode();
    } else if (e instanceof ForbiddenException forbidden) {
      code = forbidden.getCode() != null ? forbidden.getCode() : "FORBIDDEN";
    } else if (e instanceof ConversationNotFoundException) {
      code = "NOT_FOUND";
    } else {
      code = null;
    }
    Map<String, Object> event = new HashMap<>();
    event.put("type", "MESSAGE_REJECTED");
    event.put("code", code != null ? code : "BAD_REQUEST");
    if (conversationId != null) {
      event.put("conversationId", conversationId);
    }
    clusterBroker.convertAndSendToUser(userId, "/queue/notifications", event);
  }

  /** Relay a typing indicator — only from a current participant of the conversation. */
  @MessageMapping("/chat.typing")
  public void typing(@Payload ChatMessageDto dto, Principal principal) {
    if (dto.getConversationId() == null
        || !membershipCache.isMember(dto.getConversationId(), principal.getName())) {
      return;
    }
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

  // WebRTC signaling (peer-to-peer). CallSignalRelay checks that both ends belong to the
  // conversation the signal names (group mesh: the callId's) and drops a 1-on-1 signal from
  // someone the target blocked — the relay used to forward to any targetId.
  @MessageMapping("/call.offer")
  public void callOffer(
      @Payload com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
    callSignalRelay.relay(principal.getName(), "offer", dto);
  }

  @MessageMapping("/call.answer")
  public void callAnswer(
      @Payload com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
    callSignalRelay.relay(principal.getName(), "answer", dto);
  }

  @MessageMapping("/call.ice")
  public void callIceCandidate(
      @Payload com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
    callSignalRelay.relay(principal.getName(), "ice", dto);
  }

  /**
   * In-call state for the other person of a 1-on-1 (camera on/off, receive quality, reconnect
   * request) on either media path. Relayed as {@code type:"state"}; older apps ignore it.
   */
  @MessageMapping("/call.state")
  public void callState(
      @Payload com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
    callSignalRelay.relayState(principal.getName(), dto);
  }

  /**
   * Relays a hang-up to the other peer. Deliberately does NOT write a call-log message: the hang-up
   * initiator on both clients sends {@code system.call.ended:{kind}:{secs}} / {@code
   * system.call.missed:{kind}} itself, which both clients humanize (an English-only {@code
   * call_log} used to be written here too, which no locale could translate).
   */
  @MessageMapping("/call.end")
  public void callEnd(
      @Payload com.platform.chatservice.dto.WebRTCSignalDto dto, Principal principal) {
    callSignalRelay.relayEnd(principal.getName(), dto);
  }
}
