package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.MeetingMessageDto;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingMessage;
import com.platform.chatservice.service.AiConstants;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataMongoTest
@Testcontainers
class MeetingAiReplyHandlerTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  @Autowired private MongoTemplate template;
  private MeetingEvents events;
  private StringRedisTemplate redis;

  @SuppressWarnings("unchecked")
  private final ValueOperations<String, String> ops = mock(ValueOperations.class);

  private MeetingAiReplyHandler handler;

  @BeforeEach
  void setUp() {
    template.dropCollection(MeetingMessage.class);
    template.dropCollection(Meeting.class);
    template.insert(Meeting.builder().id("m1").build());
    events = mock(MeetingEvents.class);
    redis = mock(StringRedisTemplate.class);
    when(redis.opsForValue()).thenReturn(ops);
    when(ops.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);
    handler = new MeetingAiReplyHandler(template, events, redis);
  }

  private static Map<String, Object> event(String type, Object... kv) {
    Map<String, Object> e = new HashMap<>();
    e.put("type", type);
    e.put("conversationId", "meeting:m1");
    e.put("requesterId", "a");
    for (int i = 0; i < kv.length; i += 2) {
      e.put((String) kv[i], kv[i + 1]);
    }
    return e;
  }

  private long lines() {
    return template.count(new Query(), MeetingMessage.class);
  }

  @Test
  void doneStoresOneBotLineAndTellsTheRoom() {
    handler.handle(event("AI_STREAM_DONE", "fullContent", "The decision was X.", "replyId", "r1"));

    assertThat(lines()).isEqualTo(1);
    MeetingMessage saved = template.findAll(MeetingMessage.class).get(0);
    assertThat(saved.getMeetingId()).isEqualTo("m1");
    assertThat(saved.getSenderId()).isEqualTo(AiConstants.AI_BOT_USER_ID);
    assertThat(saved.getContent()).isEqualTo("The decision was X.");
    assertThat(saved.getCreatedAt()).isNotNull();
    ArgumentCaptor<MeetingMessageDto> dto = ArgumentCaptor.forClass(MeetingMessageDto.class);
    verify(events).chat(eq("m1"), dto.capture(), isNull());
    assertThat(dto.getValue().sender())
        .isEqualTo(new PersonDto(AiConstants.AI_BOT_USER_ID, "PON AI", null));
    assertThat(dto.getValue().id()).isEqualTo(saved.getId());
    verify(ops).setIfAbsent(eq("ai:done:meeting:m1:r1"), anyString(), any(Duration.class));
  }

  @Test
  void aSystemNoticeDoneIsNeverStoredNorShown() {
    handler.handle(
        event(
            "AI_STREAM_DONE",
            "fullContent",
            "Context compacted.",
            "replyId",
            "r9",
            "trace",
            Map.of("model", "system")));

    assertThat(lines()).isZero();
    verify(events, never()).chat(anyString(), any(), any());
    verify(events, never()).ai(anyString(), anyString(), any(), anyString());
  }

  @Test
  void aModelAnswerWithATraceIsStillStored() {
    handler.handle(
        event(
            "AI_STREAM_DONE",
            "fullContent",
            "Real answer",
            "replyId",
            "r8",
            "trace",
            Map.of("model", "claude-x")));

    assertThat(lines()).isEqualTo(1);
  }

  @Test
  void aSecondDoneWithTheSameReplyIdStoresNothing() {
    when(ops.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true, false);
    Map<String, Object> done = event("AI_STREAM_DONE", "fullContent", "once", "replyId", "r1");

    handler.handle(done);
    handler.handle(done);

    assertThat(lines()).isEqualTo(1);
    verify(events, org.mockito.Mockito.times(1)).chat(anyString(), any(), any());
  }

  @Test
  void longContentIsCappedAt8000() {
    handler.handle(event("AI_STREAM_DONE", "fullContent", "x".repeat(9000), "replyId", "r1"));

    assertThat(template.findAll(MeetingMessage.class).get(0).getContent()).hasSize(8000);
  }

  @Test
  void blankDoneOnlyReportsAiEmpty() {
    handler.handle(event("AI_STREAM_DONE", "fullContent", "  ", "replyId", "r1"));

    assertThat(lines()).isZero();
    verify(events).ai("m1", "error", "a", "AI_EMPTY");
    verify(events, never()).chat(anyString(), any(), any());
  }

  @Test
  void errorCarriesTheCodeOrDefaults() {
    handler.handle(event("AI_STREAM_ERROR", "code", "AI_UNAVAILABLE", "replyId", "r1"));
    handler.handle(event("AI_STREAM_ERROR", "replyId", "r2"));

    verify(events).ai("m1", "error", "a", "AI_UNAVAILABLE");
    verify(events).ai("m1", "error", "a", "AI_ERROR");
    assertThat(lines()).isZero();
  }

  @Test
  void streamingEventsAreIgnored() {
    handler.handle(event("AI_STREAM_CHUNK", "chunk", "hi"));
    handler.handle(event("AI_TOOL_CALL", "toolName", "t"));
    handler.handle(event("AI_ACTION_PENDING"));

    verifyNoInteractions(events);
    assertThat(lines()).isZero();
  }

  @Test
  void aMeetingThatNoLongerExistsIsDroppedSilently() {
    template.dropCollection(Meeting.class);

    handler.handle(event("AI_STREAM_DONE", "fullContent", "late", "replyId", "r1"));
    handler.handle(event("AI_STREAM_ERROR", "code", "AI_ERROR"));

    assertThat(lines()).isZero();
    verifyNoInteractions(events);
  }
}
