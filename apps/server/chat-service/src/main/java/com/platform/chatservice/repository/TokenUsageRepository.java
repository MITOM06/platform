package com.platform.chatservice.repository;

import com.platform.chatservice.model.TokenUsage;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface TokenUsageRepository extends MongoRepository<TokenUsage, String> {
  List<TokenUsage> findByUserIdAndDateBetweenOrderByDateAsc(String userId, String from, String to);
}
