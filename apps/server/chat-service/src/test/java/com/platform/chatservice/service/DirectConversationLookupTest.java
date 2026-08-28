package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.ConversationRepository;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Integration test for {@link ConversationRepository#findOneOnOneConversations(List)}.
 *
 * <p>Runs against a real MongoDB because the bug it guards lived in the {@code @Query} string
 * itself — mock-based tests stub the repository and can never see it. The original query matched on
 * {@code participants} alone, so a two-member GROUP satisfied it just as well as the DM: starting a
 * direct chat with someone you shared a small group with either dropped you into that group or,
 * once both existed, blew up with {@code IncorrectResultSizeDataAccessException} and left the DM
 * permanently unreachable on both web and mobile.
 */
@DataMongoTest
@Testcontainers
class DirectConversationLookupTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  private static final String ALICE = "alice-id";
  private static final String BOB = "bob-id";

  @Autowired private ConversationRepository conversationRepository;

  @BeforeEach
  void clean() {
    conversationRepository.deleteAll();
  }

  private Conversation save(String type, String name, Instant createdAt, String... participants) {
    return conversationRepository.save(
        Conversation.builder()
            .participants(List.of(participants))
            .type(type)
            .name(name)
            .createdAt(createdAt)
            .build());
  }

  @Test
  void ignoresATwoMemberGroupWithTheSameParticipants() {
    save(Conversation.TYPE_GROUP, "Just us two", Instant.now(), ALICE, BOB);

    assertThat(conversationRepository.findOneOnOneConversations(List.of(ALICE, BOB))).isEmpty();
  }

  @Test
  void findsTheDirectConversationEvenWhenATwoMemberGroupAlsoExists() {
    Conversation dm = save(Conversation.TYPE_DIRECT, null, Instant.now(), ALICE, BOB);
    save(Conversation.TYPE_GROUP, "Just us two", Instant.now(), ALICE, BOB);

    assertThat(conversationRepository.findOneOnOneConversations(List.of(ALICE, BOB)))
        .extracting(Conversation::getId)
        .containsExactly(dm.getId());
  }

  @Test
  void returnsDuplicatesOldestFirstInsteadOfThrowing() {
    Instant older = Instant.parse("2026-01-01T00:00:00Z");
    Conversation first = save(Conversation.TYPE_DIRECT, null, older, ALICE, BOB);
    Conversation second = save(Conversation.TYPE_DIRECT, null, older.plusSeconds(60), ALICE, BOB);

    assertThat(conversationRepository.findOneOnOneConversations(List.of(ALICE, BOB)))
        .extracting(Conversation::getId)
        .containsExactly(first.getId(), second.getId());
  }

  @Test
  void ignoresAThreeParticipantConversation() {
    save(Conversation.TYPE_DIRECT, null, Instant.now(), ALICE, BOB, "carol-id");

    assertThat(conversationRepository.findOneOnOneConversations(List.of(ALICE, BOB))).isEmpty();
  }
}
