package com.platform.chatservice.controller;

import com.platform.chatservice.dto.AiFeedbackRequest;
import com.platform.chatservice.dto.AiFeedbackResponse;
import com.platform.chatservice.dto.AiHistoryEntry;
import com.platform.chatservice.dto.AiTraceResponse;
import com.platform.chatservice.dto.EditMessageRequest;
import com.platform.chatservice.dto.ForwardMessageRequest;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PinResult;
import com.platform.chatservice.dto.ReactionRequest;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.AiFeedbackService;
import com.platform.chatservice.service.AiRedisPublisher;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.ExternalBotService;
import com.platform.chatservice.service.MessageNotificationService;
import com.platform.chatservice.service.MessageQueryService;
import com.platform.chatservice.service.MessageService;
import com.platform.chatservice.service.RateLimiterService;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

  private static final Pattern AI_MENTION_PATTERN = Pattern.compile("(?i)@(AI|ponai)\\b");

  private final MessageService messageService;
  private final MessageQueryService messageQueryService;
  private final MessageNotificationService messageNotificationService;
  private final ClusterMessageBroker clusterBroker;
  private final RateLimiterService rateLimiterService;
  private final AiRedisPublisher aiRedisPublisher;
  private final AiFeedbackService aiFeedbackService;
  private final ExternalBotService externalBotService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public MessageResponse sendMessage(
      @jakarta.validation.Valid @RequestBody SendMessageRequest request) {
    final String uid = currentUserId();
    rateLimiterService.checkMessageRate(uid);
    MessageResponse response = messageService.sendMessage(uid, request);
    clusterBroker.convertAndSend("/topic/conversation/" + request.conversationId(), response);
    // Same fan-out as the STOMP path: banner/unread events + FCM push for every
    // other participant. REST sends (web, attachments, mobile fallback) were
    // historically silent — recipients saw nothing until reload.
    messageNotificationService.notifyNewMessage(uid, response);

    if (request.content() != null && AI_MENTION_PATTERN.matcher(request.content()).find()) {
      final String convId = request.conversationId();
      final String raw = request.content();
      // Forward the caller's RBAC claims (P2a) so ai-service can role-filter the
      // org-context block. Legacy/unauthenticated principals yield null/empty.
      final UserPrincipal principal = currentPrincipal();
      final String role = principal != null ? principal.getRole() : null;
      final List<String> perms = principal != null ? principal.getPerms() : List.of();
      final List<String> depts = principal != null ? principal.getDepts() : List.of();
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
    if (request.content() != null) {
      final String botConvId = request.conversationId();
      final String botRaw = request.content();
      externalBotService
          .resolveAssistant(botConvId, uid)
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
    return response;
  }

  @PutMapping("/{id}")
  public MessageResponse editMessage(
      @PathVariable String id, @jakarta.validation.Valid @RequestBody EditMessageRequest request) {
    MessageResponse updated = messageService.editMessage(currentUserId(), id, request.content());
    clusterBroker.convertAndSend(
        "/topic/conversation/" + updated.conversationId(),
        Map.of(
            "type", "MESSAGE_UPDATED",
            "messageId", updated.id(),
            "conversationId", updated.conversationId(),
            "content", updated.content(),
            "editedAt", updated.editedAt().toString()));
    return updated;
  }

  /** Search messages within a conversation (Task 50). */
  @GetMapping("/search")
  public List<MessageResponse> search(
      @RequestParam("q") String query, @RequestParam("conversationId") String conversationId) {
    return messageQueryService.searchMessages(currentUserId(), conversationId, query);
  }

  @PutMapping("/{id}/read")
  public Map<String, Boolean> markAsRead(@PathVariable String id) {
    messageService.markAsRead(currentUserId(), id);
    return Map.of("success", true);
  }

  @PostMapping("/{id}/reactions")
  public MessageResponse addReaction(
      @PathVariable String id, @RequestBody ReactionRequest request) {
    MessageResponse updated = messageService.addReaction(currentUserId(), id, request.emoji());
    broadcastReaction(updated);
    return updated;
  }

  @DeleteMapping("/{id}/reactions")
  public MessageResponse removeReaction(@PathVariable String id) {
    MessageResponse updated = messageService.removeReaction(currentUserId(), id);
    broadcastReaction(updated);
    return updated;
  }

  @DeleteMapping("/{id}")
  public MessageResponse recall(@PathVariable String id) {
    MessageResponse updated = messageService.recallMessage(currentUserId(), id);
    clusterBroker.convertAndSend(
        "/topic/conversation/" + updated.conversationId(),
        Map.of(
            "type",
            "MESSAGE_RECALLED",
            "messageId",
            updated.id(),
            "conversationId",
            updated.conversationId()));
    return updated;
  }

  @PostMapping("/{id}/delete-for-me")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteForMe(@PathVariable String id) {
    messageService.deleteForMe(currentUserId(), id);
  }

  /** Returns the AI trace for a message. 404 if the message has no trace (non-AI messages). */
  @GetMapping("/{id}/trace")
  public AiTraceResponse getTrace(@PathVariable String id) {
    return messageService.getMessageTrace(currentUserId(), id);
  }

  /**
   * Pin a message in its conversation (Task 53). Broadcasts the PINNED_MESSAGE event plus a
   * persisted {@code type:"system"} "X pinned a message" notice.
   */
  @PostMapping("/{id}/pin")
  public Map<String, Object> pinMessage(@PathVariable String id) {
    PinResult result = messageService.pinMessage(currentUserId(), id);
    broadcastPinResult(id, result);
    return Map.of("pinnedMessages", result.pinnedMessages());
  }

  /**
   * Unpin a message (Task 53). Broadcasts the PINNED_MESSAGE event plus a persisted {@code
   * type:"system"} "X unpinned a message" notice.
   */
  @DeleteMapping("/{id}/pin")
  public Map<String, Object> unpinMessage(@PathVariable String id) {
    PinResult result = messageService.unpinMessage(currentUserId(), id);
    broadcastPinResult(id, result);
    return Map.of("pinnedMessages", result.pinnedMessages());
  }

  /**
   * Broadcast pin/unpin side-effects to the conversation topic: (1) the unchanged PINNED_MESSAGE
   * event so clients refresh the pinned bar/section, and (2) the persisted system MessageResponse
   * so clients append a centered "X pinned/unpinned a message" notice. No per-participant
   * /queue/notifications is sent (so the actor is never self-notified for the pin event).
   */
  private void broadcastPinResult(String messageId, PinResult result) {
    String destination = "/topic/conversation/" + result.conversationId();
    clusterBroker.convertAndSend(
        destination,
        Map.of(
            "type",
            "PINNED_MESSAGE",
            "conversationId",
            result.conversationId(),
            "messageId",
            messageId,
            "pinnedMessages",
            result.pinnedMessages()));
    clusterBroker.convertAndSend(destination, result.systemMessage());
  }

  /** Forward a message to another conversation (Task 53). */
  @PostMapping("/{id}/forward")
  @ResponseStatus(HttpStatus.CREATED)
  public MessageResponse forwardMessage(
      @PathVariable String id, @RequestBody ForwardMessageRequest request) {
    MessageResponse forwarded =
        messageService.forwardMessage(currentUserId(), id, request.targetConversationId());
    clusterBroker.convertAndSend("/topic/conversation/" + forwarded.conversationId(), forwarded);
    messageNotificationService.notifyNewMessage(currentUserId(), forwarded);
    return forwarded;
  }

  /**
   * Record the current user's 👍/👎 feedback on an (AI) message. {@code rating:"none"} clears the
   * vote. Returns the resulting feedback state. 404 if the message does not exist.
   */
  @PostMapping("/{messageId}/feedback")
  public AiFeedbackResponse submitFeedback(
      @PathVariable String messageId, @RequestBody AiFeedbackRequest request) {
    return aiFeedbackService.submitFeedback(currentUserId(), messageId, request);
  }

  private void broadcastReaction(MessageResponse message) {
    clusterBroker.convertAndSend(
        "/topic/conversation/" + message.conversationId(),
        Map.of(
            "type", "REACTION_UPDATED",
            "messageId", message.id(),
            "reactions", message.reactions()));
  }

  private String currentUserId() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication instanceof UserPrincipal principal) {
      return principal.getUserId();
    }
    throw new UnauthorizedException("User is not authenticated");
  }

  /** The authenticated principal for RBAC-claim forwarding, or null if not a UserPrincipal. */
  private UserPrincipal currentPrincipal() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    return authentication instanceof UserPrincipal principal ? principal : null;
  }
}
