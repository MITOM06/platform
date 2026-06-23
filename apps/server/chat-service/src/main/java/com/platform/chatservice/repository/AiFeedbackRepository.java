package com.platform.chatservice.repository;

import com.platform.chatservice.model.AiFeedback;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AiFeedbackRepository extends MongoRepository<AiFeedback, String> {

  Optional<AiFeedback> findByUserIdAndMessageId(String userId, String messageId);

  void deleteByUserIdAndMessageId(String userId, String messageId);
}
