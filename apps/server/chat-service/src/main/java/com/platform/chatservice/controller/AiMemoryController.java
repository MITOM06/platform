package com.platform.chatservice.controller;

import com.platform.chatservice.dto.AiMemoryResponse;
import com.platform.chatservice.model.AiMemory;
import com.platform.chatservice.repository.AiMemoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/ai/memories")
@RequiredArgsConstructor
public class AiMemoryController {

    private final AiMemoryRepository aiMemoryRepository;

    @GetMapping
    public ResponseEntity<List<AiMemoryResponse>> getMyMemories(Principal principal) {
        List<AiMemory> memories = aiMemoryRepository.findByUserId(principal.getName());
        List<AiMemoryResponse> response = memories.stream()
            .map(this::toResponse)
            .toList();
        return ResponseEntity.ok(response);
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
            m.getUpdatedAt()
        );
    }
}
