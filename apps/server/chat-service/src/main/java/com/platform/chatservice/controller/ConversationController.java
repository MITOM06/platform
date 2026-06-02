package com.platform.chatservice.controller;

import com.platform.chatservice.dto.AutoDeleteRequest;
import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.CreateConversationRequest;
import com.platform.chatservice.dto.CreateGroupRequest;
import com.platform.chatservice.dto.MembersRequest;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.UpdateConversationRequest;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.AttachmentService;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;
    private final MessageService messageService;
    private final AttachmentService attachmentService;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping
    public PageResponse<ConversationResponse> listConversations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return conversationService.listConversations(currentUserId(), PageRequest.of(page, size));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationResponse createConversation(@RequestBody CreateConversationRequest request) {
        return conversationService.createConversation(currentUserId(), request.participantId());
    }

    @PostMapping("/group")
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationResponse createGroup(@RequestBody CreateGroupRequest request) {
        ConversationResponse group = conversationService.createGroup(currentUserId(), request);
        broadcastSystem(group.id(), "system.group.created");
        return group;
    }

    @GetMapping("/{id}")
    public ConversationResponse getConversation(@PathVariable String id) {
        return conversationService.getConversation(currentUserId(), id);
    }

    @PutMapping("/{id}")
    public ConversationResponse updateGroup(@PathVariable String id,
                                            @RequestBody UpdateConversationRequest request) {
        ConversationResponse updated =
            conversationService.updateGroup(currentUserId(), id, request.name(), request.avatarUrl());
        broadcastConversationUpdated(updated);
        return updated;
    }

    @PostMapping("/{id}/members")
    public ConversationResponse addMembers(@PathVariable String id,
                                           @RequestBody MembersRequest request) {
        ConversationResponse updated =
            conversationService.addMembers(currentUserId(), id, request.userIds());
        broadcastConversationUpdated(updated);
        broadcastSystem(id, "system.members.added");
        return updated;
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ConversationResponse removeMember(@PathVariable String id, @PathVariable String userId) {
        ConversationResponse updated = conversationService.removeMember(currentUserId(), id, userId);
        broadcastConversationUpdated(updated);
        broadcastSystem(id, currentUserId().equals(userId) ? "system.member.left" : "system.member.removed");
        return updated;
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteConversation(@PathVariable String id) {
        conversationService.deleteConversation(currentUserId(), id);
    }

    @PostMapping("/{id}/clear")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearHistory(@PathVariable String id) {
        conversationService.clearHistory(currentUserId(), id);
    }

    /** Accept a pending stranger message request. */
    @PostMapping("/{id}/accept")
    public ConversationResponse acceptConversation(@PathVariable String id) {
        ConversationResponse updated = conversationService.acceptConversation(currentUserId(), id);
        broadcastConversationUpdated(updated);
        return updated;
    }

    @PostMapping("/{id}/mute")
    public ConversationResponse muteConversation(@PathVariable String id) {
        ConversationResponse updated = conversationService.muteConversation(currentUserId(), id);
        broadcastConversationUpdated(updated);
        return updated;
    }

    @PostMapping("/{id}/unmute")
    public ConversationResponse unmuteConversation(@PathVariable String id) {
        ConversationResponse updated = conversationService.unmuteConversation(currentUserId(), id);
        broadcastConversationUpdated(updated);
        return updated;
    }

    @PostMapping("/{id}/archive")
    public ConversationResponse archiveConversation(@PathVariable String id) {
        ConversationResponse updated = conversationService.archiveConversation(currentUserId(), id);
        broadcastConversationUpdated(updated);
        return updated;
    }

    @PostMapping("/{id}/unarchive")
    public ConversationResponse unarchiveConversation(@PathVariable String id) {
        ConversationResponse updated = conversationService.unarchiveConversation(currentUserId(), id);
        broadcastConversationUpdated(updated);
        return updated;
    }

    @PostMapping("/{id}/unread")
    public ConversationResponse markConversationUnread(@PathVariable String id) {
        ConversationResponse updated = conversationService.markConversationUnread(currentUserId(), id);
        broadcastConversationUpdated(updated);
        return updated;
    }

    @PostMapping("/{id}/read")
    public ConversationResponse markConversationRead(@PathVariable String id) {
        ConversationResponse updated = conversationService.markConversationRead(currentUserId(), id);
        broadcastConversationUpdated(updated);
        return updated;
    }

    @PutMapping("/{id}/settings")
    public ConversationResponse updateSettings(@PathVariable String id,
                                               @RequestBody AutoDeleteRequest request) {
        ConversationResponse updated =
            conversationService.setAutoDelete(currentUserId(), id, request.autoDeleteSeconds());
        broadcastConversationUpdated(updated);
        return updated;
    }

    /**
     * Cursor-based message history. Pass {@code before} = the oldest message id
     * the client already has to fetch the next older page; omit it for the most
     * recent page.
     */
    /** List all public group channels, optionally filtered by name (Task 52). */
    @GetMapping("/public")
    public PageResponse<ConversationResponse> listPublicChannels(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return conversationService.listPublicChannels(q, PageRequest.of(page, size));
    }

    /** Join a public channel (Task 52). */
    @PostMapping("/{id}/join")
    public ConversationResponse joinChannel(@PathVariable String id) {
        ConversationResponse updated = conversationService.joinChannel(currentUserId(), id);
        broadcastConversationUpdated(updated);
        broadcastSystem(id, "system.member.joined");
        return updated;
    }

    /**
     * Cursor-based fetch ({@code before} = oldest message id known) for normal
     * pagination, or catch-up fetch ({@code after} = ISO timestamp of newest
     * known message) for the offline reconnect flow (Task 55).
     */
    @GetMapping("/{conversationId}/messages")
    public PageResponse<MessageResponse> getMessages(
            @PathVariable String conversationId,
            @RequestParam(required = false) String before,
            @RequestParam(required = false) String after,
            @RequestParam(defaultValue = "20") int size) {
        if (after != null && !after.isBlank()) {
            java.time.Instant afterTimestamp = java.time.Instant.parse(after);
            List<MessageResponse> content =
                messageService.getMessagesSince(currentUserId(), conversationId, afterTimestamp);
            return new PageResponse<>(content, 0, content.size(), content.size());
        }
        return messageService.getMessages(currentUserId(), conversationId, before, size);
    }

    /** Shared media/files/links gallery (Task 57). */
    @GetMapping("/{conversationId}/attachments")
    public PageResponse<MessageResponse> getSharedAttachments(
            @PathVariable String conversationId,
            @RequestParam(defaultValue = "media") String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        return attachmentService.getSharedAttachments(
            currentUserId(), conversationId, type,
            PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
    }

    private void broadcastConversationUpdated(ConversationResponse conversation) {
        messagingTemplate.convertAndSend(
            "/topic/conversation/" + conversation.id(),
            Map.of("type", "CONVERSATION_UPDATED", "conversation", conversation));
    }

    /** Persist + broadcast a system message. Content is an i18n key the client maps. */
    private void broadcastSystem(String conversationId, String contentKey) {
        MessageResponse system = messageService.createSystemMessage(conversationId, contentKey);
        messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, system);
        for (String participantId : conversationService.getParticipants(conversationId)) {
            messagingTemplate.convertAndSendToUser(participantId, "/queue/notifications",
                Map.of("type", "NEW_MESSAGE", "conversationId", conversationId, "senderName", "system"));
        }
    }

    private String currentUserId() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof UserPrincipal principal) {
            return principal.getUserId();
        }
        throw new UnauthorizedException("User is not authenticated");
    }
}
