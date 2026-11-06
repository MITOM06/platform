package com.platform.chatservice.controller;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.RenameAiThreadRequest;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.AiThreadService;
import com.platform.chatservice.service.ConversationEventPublisher;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

/**
 * ChatGPT-style AI threads. Deleting a thread is the existing {@code DELETE
 * /api/conversations/{id}}.
 */
@RestController
@RequestMapping("/api/ai-threads")
@RequiredArgsConstructor
public class AiThreadController {

  private final AiThreadService aiThreadService;
  private final ConversationEventPublisher events;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ConversationResponse create() {
    String userId = currentUserId();
    ConversationResponse created = aiThreadService.create(userId);
    // The user's other devices learn about the new thread via their own notification queue.
    events.publishToUser(userId, created);
    return created;
  }

  @GetMapping
  public List<ConversationResponse> list() {
    return aiThreadService.list(currentUserId());
  }

  @PatchMapping("/{id}")
  public ConversationResponse rename(
      @PathVariable String id, @RequestBody RenameAiThreadRequest request) {
    ConversationResponse updated = aiThreadService.rename(currentUserId(), id, request.name());
    events.publishShared(updated);
    return updated;
  }

  private String currentUserId() {
    if (SecurityContextHolder.getContext().getAuthentication() instanceof UserPrincipal p) {
      return p.getUserId();
    }
    throw new UnauthorizedException("Not authenticated");
  }
}
