package com.platform.chatservice.repository;

import com.platform.chatservice.model.AiMemory;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

/**
 * {@code ai_memories} is written by ai-service, one document per (conversationId, userId) — the
 * collection has a unique compound index on the pair. Always address a single memory by BOTH
 * fields: a group conversation holds one document per member, so a lookup by conversationId alone
 * throws {@code IncorrectResultSizeDataAccessException} (and would expose another member's memory).
 */
public interface AiMemoryRepository extends MongoRepository<AiMemory, String> {

  Optional<AiMemory> findByConversationIdAndUserId(String conversationId, String userId);

  List<AiMemory> findByUserId(String userId);

  long deleteByConversationIdAndUserId(String conversationId, String userId);
}
