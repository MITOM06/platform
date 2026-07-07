package com.platform.chatservice.controller;

import com.platform.chatservice.dto.AiPersonaRequest;
import com.platform.chatservice.dto.AiPersonaResponse;
import com.platform.chatservice.model.AiPersona;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.AiPersonaRepository;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.service.AiConstants;
import jakarta.validation.Valid;
import java.security.Principal;
import java.time.Instant;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/conversations/{conversationId}/ai-persona")
@RequiredArgsConstructor
public class AiPersonaController {

  private final AiPersonaRepository aiPersonaRepository;
  private final ConversationRepository conversationRepository;

  @GetMapping
  public ResponseEntity<AiPersonaResponse> getPersona(
      @PathVariable String conversationId, Principal principal) {

    String userId = principal.getName();
    Optional<Conversation> convOpt = conversationRepository.findById(conversationId);
    if (convOpt.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    Conversation conv = convOpt.get();
    if (conv.getParticipants() == null || !conv.getParticipants().contains(userId)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    return aiPersonaRepository
        .findByConversationId(conversationId)
        .map(p -> ResponseEntity.ok(toResponse(p)))
        .orElse(ResponseEntity.notFound().build());
  }

  @PutMapping
  public ResponseEntity<AiPersonaResponse> upsertPersona(
      @PathVariable String conversationId,
      @Valid @RequestBody AiPersonaRequest request,
      Principal principal) {

    String userId = principal.getName();
    Optional<Conversation> convOpt = conversationRepository.findById(conversationId);
    if (convOpt.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    Conversation conv = convOpt.get();

    if (!canManagePersona(conv, userId)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    Optional<AiPersona> existing = aiPersonaRepository.findByConversationId(conversationId);
    AiPersona persona =
        existing.orElseGet(
            () -> AiPersona.builder().conversationId(conversationId).createdBy(userId).build());

    if (request.name() != null) persona.setName(request.name());
    if (request.avatarUrl() != null) persona.setAvatarUrl(request.avatarUrl());
    if (request.tone() != null) persona.setTone(request.tone());
    if (request.systemPromptPrefix() != null) {
      String prefix = request.systemPromptPrefix();
      persona.setSystemPromptPrefix(
          prefix.isEmpty() ? null : prefix.substring(0, Math.min(prefix.length(), 500)));
    }
    persona.setUpdatedAt(Instant.now());

    AiPersona saved = aiPersonaRepository.save(persona);
    return ResponseEntity.ok(toResponse(saved));
  }

  @DeleteMapping
  public ResponseEntity<Void> deletePersona(
      @PathVariable String conversationId, Principal principal) {

    String userId = principal.getName();
    Optional<Conversation> convOpt = conversationRepository.findById(conversationId);
    if (convOpt.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    Conversation conv = convOpt.get();

    if (!canManagePersona(conv, userId)) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    aiPersonaRepository.deleteByConversationId(conversationId);
    return ResponseEntity.noContent().build();
  }

  /**
   * Who may create/update/delete the AI persona for a conversation:
   *
   * <ul>
   *   <li><b>Group</b> — only group admins (shared "bot tổng" persona is a group-wide setting).
   *   <li><b>1-1 AI chat</b> — the human owner of their personal AI conversation (a direct
   *       conversation where the AI bot is a participant). This is the user's own bot.
   * </ul>
   *
   * Plain human-to-human direct chats have no persona and are always rejected.
   */
  private boolean canManagePersona(Conversation conv, String userId) {
    if (conv.getParticipants() == null || !conv.getParticipants().contains(userId)) {
      return false;
    }
    if (conv.isGroup()) {
      return conv.getAdmins() != null && conv.getAdmins().contains(userId);
    }
    // Direct conversation: only the user's personal AI chat (AI bot is a participant).
    return conv.getParticipants().contains(AiConstants.AI_BOT_USER_ID);
  }

  private AiPersonaResponse toResponse(AiPersona p) {
    return new AiPersonaResponse(
        p.getConversationId(),
        p.getName(),
        p.getAvatarUrl(),
        p.getTone(),
        p.getSystemPromptPrefix(),
        p.getCreatedBy(),
        p.getUpdatedAt());
  }
}
