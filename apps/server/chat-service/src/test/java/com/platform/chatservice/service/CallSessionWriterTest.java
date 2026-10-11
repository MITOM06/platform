package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.platform.chatservice.model.CallSession;
import com.platform.chatservice.repository.CallSessionRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Every call-state writer used to read the whole session, change it and replace the document. Two
 * writers at once (a member's accept over STOMP while LiveKit reports another member joining) lost
 * one change: the joined member vanished from the roster, kept a busy key, and was cut off when the
 * others left. Writes are now conditional on the version read, and retried on a conflict.
 */
@DataMongoTest
@Testcontainers
class CallSessionWriterTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  @Autowired private MongoTemplate template;
  @Autowired private CallSessionRepository repository;
  private CallSessionWriter writer;

  @BeforeEach
  void setUp() {
    repository.deleteAll();
    writer = new CallSessionWriter(repository, template);
    repository.save(
        CallSession.builder()
            .callId("c1")
            .conversationId("grp")
            .startedBy("alice")
            .transport("sfu")
            .kind("group")
            .participants(
                new ArrayList<>(
                    List.of(
                        CallSession.Participant.builder()
                            .userId("alice")
                            .joinedAt(Instant.now())
                            .build())))
            .build());
  }

  private static CallSession.Participant add(CallSession s, String userId) {
    CallSession.Participant p = CallSession.Participant.builder().userId(userId).build();
    s.getParticipants().add(p);
    return p;
  }

  @Test
  void aConcurrentWriteIsNotLost() {
    AtomicBoolean interleaved = new AtomicBoolean(false);

    writer.updateActive(
        "c1",
        s -> {
          // While this writer holds its (now stale) copy, another one saves first.
          if (interleaved.compareAndSet(false, true)) {
            writer.updateActive("c1", other -> add(other, "bob").getUserId() != null);
          }
          add(s, "carol").setAcceptedAt(Instant.now());
          return true;
        });

    CallSession stored = repository.findByCallId("c1").orElseThrow();
    assertThat(stored.getParticipants())
        .extracting(CallSession.Participant::getUserId)
        .containsExactlyInAnyOrder("alice", "bob", "carol");
  }

  @Test
  void anEndedCallIsNeverWrittenOrResurrected() {
    template.updateFirst(
        new Query(Criteria.where("callId").is("c1")),
        new Update().set("endedAt", Instant.now()),
        CallSession.class);

    assertThat(writer.updateActive("c1", s -> add(s, "bob") != null)).isEmpty();
    assertThat(repository.findByCallId("c1").orElseThrow().getParticipants()).hasSize(1);
  }

  @Test
  void aChangeThatDeclinesWritesNothing() {
    assertThat(writer.updateActive("c1", s -> false)).isEmpty();
  }

  @Test
  void returnsTheSavedSession() {
    assertThat(writer.updateActive("c1", s -> add(s, "bob") != null))
        .hasValueSatisfying(s -> assertThat(s.getParticipants()).hasSize(2));
  }
}
