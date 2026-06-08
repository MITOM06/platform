package com.platform.chatservice.repository;

import com.platform.chatservice.model.AiPersona;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface AiPersonaRepository extends MongoRepository<AiPersona, String> {

    Optional<AiPersona> findByConversationId(String conversationId);

    void deleteByConversationId(String conversationId);
}
