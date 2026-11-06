package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.model.MeetingSummaryState;
import com.platform.chatservice.repository.MeetingRepository;
import com.platform.chatservice.service.CallBusyRegistry;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Real closer + trigger + store over Mongo; only Redis and the room side-effects are mocks. */
@DataMongoTest
@Testcontainers
class MeetingCloserSummaryTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  @Autowired private MongoTemplate template;
  @Autowired private MeetingRepository repository;
  private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
  private MeetingStore store;
  private MeetingCloser closer;

  @BeforeEach
  void setUp() {
    repository.deleteAll();
    store = new MeetingStore(template, repository);
    MeetingSummaryTrigger trigger = new MeetingSummaryTrigger(store, redis, new ObjectMapper());
    closer =
        new MeetingCloser(
            store,
            mock(MeetingLobby.class),
            mock(MeetingEvents.class),
            mock(CallBusyRegistry.class),
            trigger);
  }

  private Meeting liveMeeting(String code, boolean aiEverOn) {
    Meeting m =
        store.insert(
            Meeting.builder()
                .code(code)
                .hostId("host")
                .status(MeetingStatus.LIVE)
                .sortAt(Instant.now())
                .createdAt(Instant.now().truncatedTo(ChronoUnit.MILLIS))
                .build());
    if (aiEverOn) {
      template.updateFirst(
          new Query(Criteria.where("_id").is(m.getId())),
          new Update().set("aiNotesEverEnabled", true),
          Meeting.class);
    }
    return m;
  }

  @Test
  void closePublishesSummarizeOnceWhenAiWasOn() throws Exception {
    Meeting m = liveMeeting("cs1-aaaa-aaa", true);

    assertThat(closer.close(m.getId())).isTrue();
    assertThat(closer.close(m.getId())).isFalse();

    ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
    verify(redis, times(1)).convertAndSend(eq("meet:summarize"), payload.capture());
    JsonNode json = new ObjectMapper().readTree(payload.getValue());
    Meeting stored = store.findById(m.getId()).orElseThrow();
    assertThat(json.get("meetingId").asText()).isEqualTo(m.getId());
    assertThat(json.get("attempt").asText()).isEqualTo(stored.getSummaryAttempt());
    assertThat(json.get("requesterId").asText()).isEqualTo("host");
    assertThat(stored.getSummaryState()).isEqualTo(MeetingSummaryState.PENDING);
  }

  @Test
  void closeDoesNotPublishWhenAiNeverOn() {
    Meeting m = liveMeeting("cs2-bbbb-bbb", false);

    assertThat(closer.close(m.getId())).isTrue();

    verify(redis, never()).convertAndSend(anyString(), anyString());
    assertThat(store.findById(m.getId()).orElseThrow().getSummaryState()).isNull();
  }

  @Test
  void aPublishFailureStillEndsTheMeetingAndLeavesItPending() {
    Meeting m = liveMeeting("cs3-cccc-ccc", true);
    doThrow(new IllegalStateException("redis down"))
        .when(redis)
        .convertAndSend(anyString(), anyString());

    assertThat(closer.close(m.getId())).isTrue();

    Meeting stored = store.findById(m.getId()).orElseThrow();
    assertThat(stored.getStatus()).isEqualTo(MeetingStatus.ENDED);
    assertThat(stored.getSummaryState()).isEqualTo(MeetingSummaryState.PENDING);
    assertThat(stored.getSummaryAttempt()).isNotBlank();
  }
}
