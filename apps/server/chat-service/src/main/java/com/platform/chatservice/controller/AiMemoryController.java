package com.platform.chatservice.controller;

import com.platform.chatservice.dto.AiMemoryResponse;
import com.platform.chatservice.model.AiMemory;
import com.platform.chatservice.repository.AiMemoryRepository;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai/memories")
@RequiredArgsConstructor
public class AiMemoryController {

  private final AiMemoryRepository aiMemoryRepository;

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

  @GetMapping("/{conversationId}")
  public ResponseEntity<AiMemoryResponse> getConversationMemory(
      @PathVariable String conversationId, Principal principal) {
    Optional<AiMemory> opt = aiMemoryRepository.findByConversationId(conversationId);
    if (opt.isEmpty() || !principal.getName().equals(opt.get().getUserId())) {
      return ResponseEntity.notFound().build();
    }
    return ResponseEntity.ok(toResponse(opt.get()));
  }

  @DeleteMapping("/{conversationId}")
  public ResponseEntity<Void> deleteMemory(
      @PathVariable String conversationId, Principal principal) {
    Optional<AiMemory> opt = aiMemoryRepository.findByConversationId(conversationId);
    if (opt.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    if (!principal.getName().equals(opt.get().getUserId())) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    aiMemoryRepository.deleteByConversationId(conversationId);
    return ResponseEntity.noContent().build();
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
