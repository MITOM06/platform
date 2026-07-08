package com.platform.chatservice.service;

import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.ConversationRepository;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Thin caching wrapper around ConversationRepository. Separated from ConversationService so Spring
 * AOP proxying works on findById/save.
 *
 * <p>Both @Cacheable and @CachePut must store the same type (Conversation, nullable) in the same
 * cache+key. Storing Optional<Conversation> via @Cacheable and Conversation via @CachePut would
 * produce a ClassCastException on the next @Cacheable hit → 400 from the generic handler.
 */
@Service
@RequiredArgsConstructor
public class ConversationCacheService {

  private final ConversationRepository repository;

  @Cacheable(value = "conversation", key = "#id")
  public Conversation findById(String id) {
    return repository.findById(id).orElse(null);
  }

  public Optional<Conversation> findByIdOptional(String id) {
    return Optional.ofNullable(findById(id));
  }

  @CachePut(value = "conversation", key = "#result.id")
  public Conversation save(Conversation conversation) {
    return repository.save(conversation);
  }

  /**
   * Evict a conversation from the cache so the next read reloads it fresh. Called after a targeted
   * atomic {@code $set} update (e.g. lastMessage/lastMessageAt bumps performed via MongoTemplate)
   * that does not go through {@link #save}, so cached reads do not serve stale data.
   */
  @CacheEvict(value = "conversation", key = "#id")
  public void evict(String id) {
    // Body intentionally empty — the @CacheEvict annotation performs the eviction.
  }
}
