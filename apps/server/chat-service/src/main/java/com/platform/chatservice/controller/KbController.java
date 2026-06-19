package com.platform.chatservice.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.dto.KbDocumentResponse;
import com.platform.chatservice.dto.KbUploadRequest;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.KbDocument;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.KbDocumentRepository;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/kb/documents")
@RequiredArgsConstructor
public class KbController {

  private static final String KB_PROCESS_CHANNEL = "kb:process";
  private static final String KB_DELETE_CHANNEL = "kb:delete";

  private final KbDocumentRepository kbDocumentRepository;
  private final ConversationRepository conversationRepository;
  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;

  @PostMapping
  public ResponseEntity<KbDocumentResponse> uploadDocument(
      @RequestBody KbUploadRequest request, Principal principal) throws JsonProcessingException {

    requireParticipant(request.getConversationId(), principal.getName());

    String documentId = UUID.randomUUID().toString();
    KbDocument doc =
        KbDocument.builder()
            .documentId(documentId)
            .conversationId(request.getConversationId())
            .userId(principal.getName())
            .fileName(request.getFileName())
            .mimeType(request.getMimeType())
            .fileUrl(request.getFileUrl())
            .status("pending")
            .chunkCount(0)
            .uploadedAt(Instant.now())
            .build();

    kbDocumentRepository.save(doc);

    Map<String, String> payload =
        Map.of(
            "documentId", documentId,
            "conversationId", request.getConversationId(),
            "userId", principal.getName(),
            "fileUrl", request.getFileUrl(),
            "mimeType", request.getMimeType(),
            "fileName", request.getFileName());
    redisTemplate.convertAndSend(KB_PROCESS_CHANNEL, objectMapper.writeValueAsString(payload));

    return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(doc));
  }

  @GetMapping
  public ResponseEntity<List<KbDocumentResponse>> getDocuments(
      @RequestParam String conversationId, Principal principal) {

    requireParticipant(conversationId, principal.getName());

    List<KbDocumentResponse> docs =
        kbDocumentRepository.findByConversationIdOrderByUploadedAtDesc(conversationId).stream()
            .map(this::toResponse)
            .toList();

    return ResponseEntity.ok(docs);
  }

  @DeleteMapping("/{documentId}")
  public ResponseEntity<Void> deleteDocument(@PathVariable String documentId, Principal principal)
      throws JsonProcessingException {

    Optional<KbDocument> opt = kbDocumentRepository.findByDocumentId(documentId);
    if (opt.isEmpty()) return ResponseEntity.notFound().build();

    KbDocument doc = opt.get();
    requireParticipant(doc.getConversationId(), principal.getName());

    kbDocumentRepository.deleteByDocumentId(documentId);

    // Signal ai-service to remove vectors from Qdrant
    Map<String, String> payload = Map.of("documentId", documentId);
    redisTemplate.convertAndSend(KB_DELETE_CHANNEL, objectMapper.writeValueAsString(payload));

    return ResponseEntity.noContent().build();
  }

  private void requireParticipant(String conversationId, String userId) {
    Conversation conv =
        conversationRepository
            .findById(conversationId)
            .orElseThrow(() -> new ForbiddenException("Conversation not found"));
    if (conv.getParticipants() == null || !conv.getParticipants().contains(userId)) {
      throw new ForbiddenException("Not a participant of this conversation");
    }
  }

  private KbDocumentResponse toResponse(KbDocument doc) {
    return new KbDocumentResponse(
        doc.getDocumentId(),
        doc.getFileName(),
        doc.getMimeType(),
        doc.getStatus(),
        doc.getChunkCount(),
        doc.getUploadedAt());
  }
}
