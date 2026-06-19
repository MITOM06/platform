package com.platform.chatservice.repository;

import com.platform.chatservice.model.KbDocument;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface KbDocumentRepository extends MongoRepository<KbDocument, String> {

  List<KbDocument> findByConversationIdOrderByUploadedAtDesc(String conversationId);

  Optional<KbDocument> findByDocumentId(String documentId);

  void deleteByDocumentId(String documentId);
}
