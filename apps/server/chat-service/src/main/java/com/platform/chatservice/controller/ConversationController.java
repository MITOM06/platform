package com.platform.chatservice.controller;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.CreateConversationRequest;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;
    private final MessageService messageService;

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

    @GetMapping("/{id}")
    public ConversationResponse getConversation(@PathVariable String id) {
        return conversationService.getConversation(currentUserId(), id);
    }

    @GetMapping("/{conversationId}/messages")
    public PageResponse<MessageResponse> getMessages(
            @PathVariable String conversationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return messageService.getMessages(currentUserId(), conversationId, PageRequest.of(page, size));
    }

    private String currentUserId() {
        return ((UserPrincipal) SecurityContextHolder.getContext().getAuthentication()).getUserId();
    }
}
