package com.platform.chatservice.repository;

import com.platform.chatservice.model.ExternalBot;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ExternalBotRepository extends MongoRepository<ExternalBot, String> {

  Optional<ExternalBot> findByBotUserId(String botUserId);

  Optional<ExternalBot> findByOwnerUserIdAndEnabledTrue(String ownerUserId);

  boolean existsByBotUserId(String botUserId);
}
