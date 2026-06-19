package com.platform.chatservice.repository;

import com.platform.chatservice.model.UserBlock;
import org.springframework.data.mongodb.repository.MongoRepository;

/**
 * Reads the {@code user_blocks} collection (owned by auth-service) to evaluate block relationships.
 * Backed by the unique {@code (blockerId, blockedId)} index, so each check is an indexed lookup.
 */
public interface UserBlockRepository extends MongoRepository<UserBlock, String> {

  boolean existsByBlockerIdAndBlockedId(String blockerId, String blockedId);
}
