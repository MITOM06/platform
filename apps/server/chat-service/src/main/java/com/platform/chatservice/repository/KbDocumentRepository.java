package com.platform.chatservice.repository;

import com.platform.chatservice.model.KbDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KbDocumentRepository extends MongoRepository<KbDocument, String> {

    List<KbDocument> findByConversationIdOrderByUploadedAtDesc(String conversationId);

    Optional<KbDocument> findByDocumentId(String documentId);

    void deleteByDocumentId(String documentId);
}
