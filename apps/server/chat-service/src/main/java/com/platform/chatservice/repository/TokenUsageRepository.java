package com.platform.chatservice.repository;

import com.platform.chatservice.model.TokenUsage;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

public interface TokenUsageRepository extends MongoRepository<TokenUsage, String> {
  /**
   * Usage rows for {@code userId} with {@code from <= date <= to} (ISO yyyy-MM-dd). Spelled out
   * because the derived {@code DateBetween} is EXCLUSIVE on both ends in Spring Data MongoDB
   * ($gt/$lt) — the personal dashboard never showed today's usage.
   */
  @Query(value = "{ 'userId': ?0, 'date': { $gte: ?1, $lte: ?2 } }", sort = "{ 'date': 1 }")
  List<TokenUsage> findUsageInRange(String userId, String from, String to);
}
