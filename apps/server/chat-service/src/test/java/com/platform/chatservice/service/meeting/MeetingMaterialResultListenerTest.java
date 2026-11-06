package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingMessage;
import com.platform.chatservice.model.MeetingRecord;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingMaterialResultListenerTest {

  private static final Instant SENT = Instant.parse("2026-11-07T01:02:03Z");
  private final ObjectMapper mapper = new ObjectMapper();
  @Mock private MeetingStore store;
  @Mock private MongoTemplate mongo;
  @Mock private MeetingPeople people;
  @Mock private MeetingRecordService records;
  @Mock private StringRedisTemplate redis;
  @Mock private ValueOperations<String, String> ops;
  private MeetingMaterialResultListener listener;

  @BeforeEach
  void setUp() {
    when(redis.opsForValue()).thenReturn(ops);
    when(ops.setIfAbsent("meet:material:done:msg1", "1", Duration.ofHours(1)))
        .thenReturn(true, false);
    when(store.findById("m1")).thenReturn(Optional.of(Meeting.builder().id("m1").build()));
    when(mongo.findById("msg1", MeetingMessage.class))
        .thenReturn(
            MeetingMessage.builder()
                .id("msg1")
                .meetingId("m1")
                .senderId("u1")
                .createdAt(SENT)
                .build());
    when(people.profiles(any(java.util.Collection.class)))
        .thenReturn(Map.of("u1", new PersonDto("u1", "An", null)));
    listener = new MeetingMaterialResultListener(store, mongo, people, records, redis, mapper);
  }

  private void deliver(String json) throws Exception {
    listener.handle(mapper.readTree(json));
  }

  private MeetingRecord oneRecord() {
    ArgumentCaptor<MeetingRecord> rec = ArgumentCaptor.forClass(MeetingRecord.class);
    verify(records).append(rec.capture());
    return rec.getValue();
  }

  @Test
  void okWritesOneFileRecordCappedAt6000() throws Exception {
    String text = "x".repeat(7000);
    deliver(
        "{\"meetingId\":\"m1\",\"messageId\":\"msg1\",\"fileName\":\"plan.pdf\","
            + "\"status\":\"ok\",\"text\":\""
            + text
            + "\"}");

    MeetingRecord r = oneRecord();
    assertThat(r.getKind()).isEqualTo(MeetingRecord.Kind.FILE);
    assertThat(r.getMeetingId()).isEqualTo("m1");
    assertThat(r.getUserId()).isEqualTo("u1");
    assertThat(r.getDisplayName()).isEqualTo("An");
    assertThat(r.getFileName()).isEqualTo("plan.pdf");
    assertThat(r.getTs()).isEqualTo(SENT);
    assertThat(r.getText()).hasSize(6000);
  }

  @Test
  void ref_isTheUploadIdOfTheLine() throws Exception {
    when(mongo.findById("msg1", MeetingMessage.class))
        .thenReturn(
            MeetingMessage.builder()
                .id("msg1")
                .meetingId("m1")
                .senderId("u1")
                .createdAt(SENT)
                .attachment(
                    com.platform.chatservice.model.MeetingAttachment.builder()
                        .uploadId("up-1")
                        .name("stored.pdf")
                        .build())
                .build());

    deliver(
        "{\"meetingId\":\"m1\",\"messageId\":\"msg1\",\"fileName\":\"p.pdf\",\"status\":\"ok\",\"text\":\"hi\"}");

    assertThat(oneRecord().getRef()).isEqualTo("up-1");
  }

  @Test
  void unsupportedFailedAndUnknownStatusesBecomeTheCouldNotReadLine() throws Exception {
    for (String status : List.of("unsupported", "failed", "weird")) {
      org.mockito.Mockito.clearInvocations(records);
      when(ops.setIfAbsent("meet:material:done:msg1", "1", Duration.ofHours(1))).thenReturn(true);
      deliver(
          "{\"meetingId\":\"m1\",\"messageId\":\"msg1\",\"fileName\":\"a.zip\",\"status\":\""
              + status
              + "\",\"text\":\"ignored\"}");
      assertThat(oneRecord().getText()).isEqualTo("Không đọc được file này.");
    }
  }

  @Test
  void theSameResultTwiceWritesOneLine() throws Exception {
    String json =
        "{\"meetingId\":\"m1\",\"messageId\":\"msg1\",\"fileName\":\"a.pdf\",\"status\":\"ok\",\"text\":\"hi\"}";
    deliver(json);
    deliver(json);

    oneRecord(); // verify(records) is times(1)
  }

  @Test
  void aMeetingThatIsGoneOrAnUnknownLineIsDropped() throws Exception {
    when(store.findById("gone")).thenReturn(Optional.empty());
    deliver("{\"meetingId\":\"gone\",\"messageId\":\"msg1\",\"status\":\"ok\",\"text\":\"hi\"}");
    when(mongo.findById("other", MeetingMessage.class)).thenReturn(null);
    deliver("{\"meetingId\":\"m1\",\"messageId\":\"other\",\"status\":\"ok\",\"text\":\"hi\"}");
    when(mongo.findById("foreign", MeetingMessage.class))
        .thenReturn(MeetingMessage.builder().id("foreign").meetingId("m2").senderId("u1").build());
    deliver("{\"meetingId\":\"m1\",\"messageId\":\"foreign\",\"status\":\"ok\",\"text\":\"hi\"}");

    verify(records, never()).append(any());
  }

  @Test
  void garbageNeverThrows() {
    assertThatCode(() -> listener.onMessage(msg("not json"), null)).doesNotThrowAnyException();
    assertThatCode(() -> listener.onMessage(msg("{}"), null)).doesNotThrowAnyException();
    when(records.append(any())).thenThrow(new IllegalStateException("mongo down"));
    assertThatCode(
            () ->
                listener.onMessage(
                    msg(
                        "{\"meetingId\":\"m1\",\"messageId\":\"msg1\",\"status\":\"ok\",\"text\":\"t\"}"),
                    null))
        .doesNotThrowAnyException();
  }

  private static org.springframework.data.redis.connection.Message msg(String body) {
    org.springframework.data.redis.connection.Message m =
        org.mockito.Mockito.mock(org.springframework.data.redis.connection.Message.class);
    when(m.getBody()).thenReturn(body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    return m;
  }
}
