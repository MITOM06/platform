package com.platform.chatservice.repository;

import com.platform.chatservice.model.AiMemory;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AiMemoryRepository extends MongoRepository<AiMemory, String> {

  Optional<AiMemory> findByConversationId(String conversationId);

  List<AiMemory> findByUserId(String userId);

  void deleteByConversationId(String conversationId);
}
