package com.platform.chatservice.repository;

import com.platform.chatservice.model.AiMemory;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface AiMemoryRepository extends MongoRepository<AiMemory, String> {

    Optional<AiMemory> findByConversationId(String conversationId);

    List<AiMemory> findByUserId(String userId);

    void deleteByConversationId(String conversationId);
}
