package com.platform.chatservice.controller;

import com.platform.chatservice.dto.EditMessageRequest;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.ReactionRequest;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse sendMessage(@RequestBody SendMessageRequest request) {
        return messageService.sendMessage(currentUserId(), request);
    }

    @PutMapping("/{id}")
    public MessageResponse editMessage(@PathVariable String id, @RequestBody EditMessageRequest request) {
        MessageResponse updated = messageService.editMessage(currentUserId(), id, request.content());
        messagingTemplate.convertAndSend(
            "/topic/conversation/" + updated.conversationId(),
            Map.of("type", "MESSAGE_UPDATED",
                   "messageId", updated.id(),
                   "conversationId", updated.conversationId(),
                   "content", updated.content(),
                   "editedAt", updated.editedAt().toString()));
        return updated;
    }

    /** Search messages within a conversation (Task 50). */
    @GetMapping("/search")
    public List<MessageResponse> search(@RequestParam("q") String query,
                                        @RequestParam("conversationId") String conversationId) {
        return messageService.searchMessages(currentUserId(), conversationId, query);
    }

    @PutMapping("/{id}/read")
    public Map<String, Boolean> markAsRead(@PathVariable String id) {
        messageService.markAsRead(currentUserId(), id);
        return Map.of("success", true);
    }

    @PostMapping("/{id}/reactions")
    public MessageResponse addReaction(@PathVariable String id, @RequestBody ReactionRequest request) {
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
        messagingTemplate.convertAndSend(
            "/topic/conversation/" + updated.conversationId(),
            Map.of("type", "MESSAGE_RECALLED", "messageId", updated.id(),
                   "conversationId", updated.conversationId()));
        return updated;
    }

    @PostMapping("/{id}/delete-for-me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteForMe(@PathVariable String id) {
        messageService.deleteForMe(currentUserId(), id);
    }

    private void broadcastReaction(MessageResponse message) {
        messagingTemplate.convertAndSend(
            "/topic/conversation/" + message.conversationId(),
            Map.of("type", "REACTION_UPDATED",
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
}
