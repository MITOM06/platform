package com.platform.chatservice.repository;

import com.platform.chatservice.model.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

public interface MessageRepository extends MongoRepository<Message, String> {

    Page<Message> findByConversationIdOrderByCreatedAtDesc(String conversationId, Pageable pageable);

    @Query(value = "{ 'conversationId': ?0, 'readBy': { $nin: [?1] } }", count = true)
    long countUnread(String conversationId, String userId);
}
