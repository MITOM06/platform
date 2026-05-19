package com.platform.chatservice.repository;

import com.platform.chatservice.model.Conversation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends MongoRepository<Conversation, String> {

    Page<Conversation> findByParticipantsContainingOrderByLastMessageAtDesc(String userId, Pageable pageable);

    @Query("{ 'participants': { $all: ?0, $size: 2 } }")
    Optional<Conversation> findOneOnOneConversation(List<String> participants);
}
