package com.platform.chatservice.repository;

import com.platform.chatservice.model.ExternalBot;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ExternalBotRepository extends MongoRepository<ExternalBot, String> {

  Optional<ExternalBot> findByBotUserId(String botUserId);

  /**
   * A member's enabled assistant mappings, newest first. Normally one; a list (not {@code
   * Optional}) so an accidental duplicate degrades to "use the newest" instead of throwing {@code
   * IncorrectResultSizeDataAccessException} on every call.
   */
  List<ExternalBot> findByOwnerUserIdAndEnabledTrueOrderByCreatedAtDesc(String ownerUserId);

  boolean existsByBotUserId(String botUserId);

  void deleteByOwnerUserId(String ownerUserId);
}
