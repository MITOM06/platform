package com.platform.chatservice.repository;

import com.platform.chatservice.model.UserBlock;
import org.springframework.data.mongodb.repository.MongoRepository;

/**
 * Reads the {@code users} collection (owned by auth-service) to evaluate block relationships.
 * {@code findById} converts the String id to the user's ObjectId.
 */
public interface UserBlockRepository extends MongoRepository<UserBlock, String> {}
