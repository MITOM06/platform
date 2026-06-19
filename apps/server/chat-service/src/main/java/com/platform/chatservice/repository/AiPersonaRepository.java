package com.platform.chatservice.repository;

import com.platform.chatservice.model.AiPersona;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AiPersonaRepository extends MongoRepository<AiPersona, String> {

  Optional<AiPersona> findByConversationId(String conversationId);

  void deleteByConversationId(String conversationId);
}
