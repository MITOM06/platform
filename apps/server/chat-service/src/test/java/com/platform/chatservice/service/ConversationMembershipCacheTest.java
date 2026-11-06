package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.model.Conversation;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.redis.connection.DefaultMessage;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Hot-path membership check used by the STOMP outbound filter + typing relay: a removed member must
 * stop receiving frames, a Mongo outage must fail CLOSED for an unknown conversation, and a stale
 * entry is only served while a refresh fails.
 */
class ConversationMembershipCacheTest {

  private final MongoTemplate mongo = mock(MongoTemplate.class);
  private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
  private final AtomicLong now = new AtomicLong(1_000_000);
  private final ConversationMembershipCache cache =
      new ConversationMembershipCache(mongo, redis, now::get);

  private void participants(String... ids) {
    Conversation c =
        Conversation.builder().id("c1").participants(new ArrayList<>(Arrays.asList(ids))).build();
    when(mongo.findOne(any(Query.class), eq(Conversation.class))).thenReturn(c);
  }

  @Test
  void memberIsAllowedAndOutsiderDenied() {
    participants("alice", "bob");
    assertThat(cache.isMember("c1", "alice")).isTrue();
    assertThat(cache.isMember("c1", "mallory")).isFalse();
  }

  @Test
  void nullIdsAreDeniedWithoutQuerying() {
    assertThat(cache.isMember(null, "alice")).isFalse();
    assertThat(cache.isMember("c1", null)).isFalse();
    verify(mongo, never()).findOne(any(Query.class), eq(Conversation.class));
  }

  @Test
  void unknownConversationOrNullParticipantsDenies() {
    when(mongo.findOne(any(Query.class), eq(Conversation.class))).thenReturn(null);
    assertThat(cache.isMember("c1", "alice")).isFalse();

    now.addAndGet(ConversationMembershipCache.TTL_MS);
    when(mongo.findOne(any(Query.class), eq(Conversation.class)))
        .thenReturn(Conversation.builder().id("c1").participants(null).build());
    assertThat(cache.isMember("c1", "alice")).isFalse();
  }

  @Test
  void nullEntriesInParticipantsAreIgnored() {
    List<String> withNull = new ArrayList<>(Arrays.asList("alice", null));
    when(mongo.findOne(any(Query.class), eq(Conversation.class)))
        .thenReturn(Conversation.builder().id("c1").participants(withNull).build());
    assertThat(cache.isMember("c1", "alice")).isTrue();
  }

  @Test
  void entryIsCachedUntilTtlThenReloaded() {
    participants("alice");
    cache.isMember("c1", "alice");
    now.addAndGet(ConversationMembershipCache.TTL_MS - 1);
    cache.isMember("c1", "alice");
    verify(mongo, times(1)).findOne(any(Query.class), eq(Conversation.class));

    // Removed from the group in Mongo; after the TTL the cache must reflect it.
    participants("bob");
    now.addAndGet(1);
    assertThat(cache.isMember("c1", "alice")).isFalse();
    verify(mongo, times(2)).findOne(any(Query.class), eq(Conversation.class));
  }

  @Test
  void mongoFailureWithoutCachedEntryFailsClosed() {
    when(mongo.findOne(any(Query.class), eq(Conversation.class)))
        .thenThrow(new RuntimeException("mongo down"));
    assertThat(cache.isMember("c1", "alice")).isFalse();
  }

  @Test
  void mongoFailureOnRefreshServesStaleEntry() {
    participants("alice");
    assertThat(cache.isMember("c1", "alice")).isTrue();
    now.addAndGet(ConversationMembershipCache.TTL_MS);
    when(mongo.findOne(any(Query.class), eq(Conversation.class)))
        .thenThrow(new RuntimeException("blip"));
    assertThat(cache.isMember("c1", "alice")).isTrue();
    assertThat(cache.isMember("c1", "mallory")).isFalse();
  }

  @Test
  void invalidateDropsLocalEntryAndBroadcasts() {
    participants("alice");
    cache.isMember("c1", "alice");
    participants("bob"); // alice kicked

    cache.invalidate("c1");

    assertThat(cache.isMember("c1", "alice")).isFalse();
    verify(redis).convertAndSend(ConversationMembershipCache.CHANNEL, "c1");
  }

  @Test
  void invalidateSurvivesRedisFailureAndIgnoresNull() {
    participants("alice");
    cache.isMember("c1", "alice");
    doThrow(new RuntimeException("redis down")).when(redis).convertAndSend(any(), any());

    cache.invalidate("c1");
    participants("bob");
    assertThat(cache.isMember("c1", "alice")).isFalse();

    cache.invalidate(null);
    verify(redis, times(1)).convertAndSend(any(), any());
  }

  @Test
  void remoteInvalidationEvictsTheEntry() {
    participants("alice");
    cache.isMember("c1", "alice");
    participants("bob");

    cache.onMessage(
        new DefaultMessage(
            ConversationMembershipCache.CHANNEL.getBytes(StandardCharsets.UTF_8),
            " c1 \n".getBytes(StandardCharsets.UTF_8)),
        null);

    assertThat(cache.isMember("c1", "alice")).isFalse();
  }

  @Test
  void blankRemoteInvalidationIsIgnored() {
    participants("alice");
    cache.isMember("c1", "alice");
    cache.onMessage(new DefaultMessage(new byte[0], "   ".getBytes(StandardCharsets.UTF_8)), null);
    cache.isMember("c1", "alice");
    verify(mongo, times(1)).findOne(any(Query.class), eq(Conversation.class));
  }
}
