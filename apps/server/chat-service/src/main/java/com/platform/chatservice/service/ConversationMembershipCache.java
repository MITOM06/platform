package com.platform.chatservice.service;

import com.platform.chatservice.model.Conversation;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Hot-path "is this user a participant?" check for STOMP traffic: the outbound filter that stops
 * removed members from receiving live frames, and the typing relay. Participants are cached per
 * conversation for {@link #TTL_MS} and dropped as soon as the membership changes — locally and, via
 * the {@link #CHANNEL} Redis channel, on every other chat-service instance.
 *
 * <p>SUBSCRIBE authorization deliberately does NOT use this cache (it reads Mongo directly): a
 * member who was just added must be able to subscribe immediately, even on an instance whose entry
 * is still a few seconds old.
 */
@Component
@Slf4j
public class ConversationMembershipCache implements MessageListener {

  /** Redis pub/sub channel carrying the id of a conversation whose membership changed. */
  public static final String CHANNEL = "chat:conversation-membership";

  static final long TTL_MS = 10_000;
  private static final int PURGE_THRESHOLD = 50_000;

  private final MongoTemplate mongoTemplate;
  private final StringRedisTemplate redisTemplate;
  private final LongSupplier clock;
  private final Map<String, Entry> cache = new ConcurrentHashMap<>();

  private record Entry(Set<String> participants, long expiresAt) {}

  @Autowired
  public ConversationMembershipCache(
      MongoTemplate mongoTemplate, StringRedisTemplate redisTemplate) {
    this(mongoTemplate, redisTemplate, System::currentTimeMillis);
  }

  ConversationMembershipCache(
      MongoTemplate mongoTemplate, StringRedisTemplate redisTemplate, LongSupplier clock) {
    this.mongoTemplate = mongoTemplate;
    this.redisTemplate = redisTemplate;
    this.clock = clock;
  }

  /** True iff {@code userId} is currently a participant of {@code conversationId}. */
  public boolean isMember(String conversationId, String userId) {
    if (conversationId == null || userId == null) {
      return false;
    }
    long now = clock.getAsLong();
    Entry entry = cache.get(conversationId);
    if (entry == null || entry.expiresAt() <= now) {
      try {
        entry = new Entry(loadParticipants(conversationId), now + TTL_MS);
        if (cache.size() > PURGE_THRESHOLD) {
          cache.values().removeIf(e -> e.expiresAt() <= now);
        }
        cache.put(conversationId, entry);
      } catch (RuntimeException e) {
        if (entry == null) {
          log.warn("Membership lookup failed for {} (denying): {}", conversationId, e.toString());
          return false;
        }
        // Serve the stale entry rather than cutting every member off during a Mongo blip.
        log.warn(
            "Membership refresh failed for {} (using stale entry): {}",
            conversationId,
            e.toString());
      }
    }
    return entry.participants().contains(userId);
  }

  /** Forget {@code conversationId} here and on every other instance (membership changed). */
  public void invalidate(String conversationId) {
    if (conversationId == null) return;
    cache.remove(conversationId);
    try {
      redisTemplate.convertAndSend(CHANNEL, conversationId);
    } catch (RuntimeException e) {
      // Other instances fall back to the short TTL.
      log.warn(
          "Could not publish membership invalidation for {}: {}", conversationId, e.toString());
    }
  }

  /** Invalidation published by another instance (or echoed back from this one). */
  @Override
  public void onMessage(Message message, byte[] pattern) {
    String conversationId = new String(message.getBody(), StandardCharsets.UTF_8).trim();
    if (!conversationId.isEmpty()) {
      cache.remove(conversationId);
    }
  }

  private Set<String> loadParticipants(String conversationId) {
    Query query = new Query(Criteria.where("_id").is(conversationId));
    query.fields().include("participants");
    Conversation conversation = mongoTemplate.findOne(query, Conversation.class);
    if (conversation == null || conversation.getParticipants() == null) {
      return Set.of();
    }
    return conversation.getParticipants().stream()
        .filter(Objects::nonNull)
        .collect(Collectors.toUnmodifiableSet());
  }
}
