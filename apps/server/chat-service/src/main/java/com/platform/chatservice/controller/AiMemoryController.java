package com.platform.chatservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.dto.AiMemoryResponse;
import com.platform.chatservice.model.AiMemory;
import com.platform.chatservice.repository.AiMemoryRepository;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai/memories")
@RequiredArgsConstructor
@Slf4j
public class AiMemoryController {

  /**
   * chat-service → ai-service: drop the embedded facts (vectors) of one user's memory in one
   * conversation. Payload {@code {"conversationId","userId"}}; same style as {@code kb:delete}.
   */
  static final String AI_MEMORY_DELETE_CHANNEL = "ai:memory:delete";

  private final AiMemoryRepository aiMemoryRepository;
  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;

  @GetMapping
  public ResponseEntity<AiMemoryResponse> getMyMemories(Principal principal) {
    List<AiMemory> memories =
        new java.util.ArrayList<>(aiMemoryRepository.findByUserId(principal.getName()));
    // Memory is now global per-user (facts recall across every conversation). Collapse
    // the caller's per-conversation docs into ONE aggregate: union of keyFacts
    // (most-recent conversation first, deduped), newest summary, total message count.
    memories.sort(
        java.util.Comparator.comparing(
                AiMemory::getUpdatedAt,
                java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
            .reversed());
    java.util.LinkedHashSet<String> facts = new java.util.LinkedHashSet<>();
    for (AiMemory m : memories) {
      if (m.getKeyFacts() != null) {
        facts.addAll(m.getKeyFacts());
      }
    }
    String summary = memories.isEmpty() ? "" : memories.get(0).getSummary();
    Instant updatedAt = memories.isEmpty() ? null : memories.get(0).getUpdatedAt();
    int totalCount =
        memories.stream()
            .mapToInt(m -> m.getMessageCount() == null ? 0 : m.getMessageCount())
            .sum();
    AiMemoryResponse aggregate =
        new AiMemoryResponse(
            null,
            summary == null ? "" : summary,
            new java.util.ArrayList<>(facts),
            totalCount,
            updatedAt);
    return ResponseEntity.ok(aggregate);
  }

  /** The caller's own memory in this conversation (memories are per conversation AND user). */
  @GetMapping("/{conversationId}")
  public ResponseEntity<AiMemoryResponse> getConversationMemory(
      @PathVariable String conversationId, Principal principal) {
    return aiMemoryRepository
        .findByConversationIdAndUserId(conversationId, principal.getName())
        .map(m -> ResponseEntity.ok(toResponse(m)))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  /**
   * Forget the caller's memory in this conversation: deletes their document, then asks ai-service
   * (Redis {@value #AI_MEMORY_DELETE_CHANNEL}) to delete that user's embedded facts for the
   * conversation. The vector clean-up is requested even when no document is left (idempotent), so a
   * retry can always finish a half-done delete. 404 when the caller had no memory here.
   */
  @DeleteMapping("/{conversationId}")
  public ResponseEntity<Void> deleteMemory(
      @PathVariable String conversationId, Principal principal) {
    String userId = principal.getName();
    Optional<AiMemory> existing =
        aiMemoryRepository.findByConversationIdAndUserId(conversationId, userId);
    if (existing.isPresent()) {
      aiMemoryRepository.deleteByConversationIdAndUserId(conversationId, userId);
    }
    publishVectorDelete(conversationId, userId);
    return existing.isPresent()
        ? ResponseEntity.noContent().build()
        : ResponseEntity.notFound().build();
  }

  private void publishVectorDelete(String conversationId, String userId) {
    try {
      Map<String, String> payload = Map.of("conversationId", conversationId, "userId", userId);
      redisTemplate.convertAndSend(
          AI_MEMORY_DELETE_CHANNEL, objectMapper.writeValueAsString(payload));
    } catch (Exception e) {
      // The Mongo document is already gone; the user can retry DELETE to re-request the clean-up.
      log.error(
          "Failed to publish {} for conversation {}", AI_MEMORY_DELETE_CHANNEL, conversationId, e);
    }
  }

  private AiMemoryResponse toResponse(AiMemory m) {
    return new AiMemoryResponse(
        m.getConversationId(),
        m.getSummary(),
        m.getKeyFacts(),
        m.getMessageCount(),
        m.getUpdatedAt());
  }
}
