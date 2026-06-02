package com.platform.chatservice.repository;

import com.platform.chatservice.model.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.Instant;
import java.util.List;

public interface MessageRepository extends MongoRepository<Message, String> {

    Page<Message> findByConversationIdOrderByCreatedAtDesc(String conversationId, Pageable pageable);

    /** Cursor page: messages strictly older than the cursor's createdAt (newest first). */
    List<Message> findByConversationIdAndCreatedAtLessThanOrderByCreatedAtDesc(
        String conversationId, Instant createdAt, Pageable pageable);

    /** Catch-up page: messages strictly newer than afterTimestamp (oldest first). */
    List<Message> findByConversationIdAndCreatedAtGreaterThanOrderByCreatedAtAsc(
        String conversationId, Instant createdAt, Pageable pageable);

    @Query(value = "{ 'conversationId': ?0, 'readBy': { $nin: [?1] } }", count = true)
    long countUnread(String conversationId, String userId);

    /** Shared gallery: messages of specific types (image, video, file). */
    Page<Message> findByConversationIdAndTypeInOrderByCreatedAtDesc(
        String conversationId, List<String> types, Pageable pageable);

    /** Shared gallery: text messages whose content contains a URL (Task 57). */
    @Query("{ 'conversationId': ?0, 'type': 'text', 'recalled': { $ne: true }, 'content': { $regex: 'https?://', $options: 'i' } }")
    Page<Message> findLinksByConversationId(String conversationId, Pageable pageable);
}
