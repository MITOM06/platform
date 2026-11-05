package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingRecord;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataMongoTest
@Testcontainers
class MeetingRecordServiceTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  @Autowired private MongoTemplate template;
  @Autowired private MongoMappingContext mappingContext;
  private MeetingGuard guard;
  private MeetingPeople people;
  private MeetingRecordService records;
  private final UserPrincipal an = new UserPrincipal("a");

  @BeforeEach
  void setUp() {
    template.dropCollection(MeetingRecord.class);
    IndexOperations ops = template.indexOps(MeetingRecord.class);
    new MongoPersistentEntityIndexResolver(mappingContext)
        .resolveIndexFor(MeetingRecord.class)
        .forEach(ops::ensureIndex);
    guard = mock(MeetingGuard.class);
    people = mock(MeetingPeople.class);
    when(people.profiles(anyCollection())).thenReturn(Map.of("a", new PersonDto("a", "An", null)));
    when(guard.inRoom(an, "m1")).thenReturn(meeting(true));
    records = new MeetingRecordService(template, guard, people);
  }

  private static Meeting meeting(boolean aiNotes) {
    return meeting(aiNotes, null);
  }

  private static Meeting meeting(boolean aiNotes, Instant leftAt) {
    return Meeting.builder()
        .settings(Meeting.Settings.builder().aiNotes(aiNotes).build())
        .attendance(
            new java.util.ArrayList<>(
                List.of(Meeting.Attendance.builder().userId("a").leftAt(leftAt).build())))
        .build();
  }

  private long count() {
    return template.count(new Query(), MeetingRecord.class);
  }

  @Test
  void storesTrimmedSpeechWithSpeakerName() {
    long ts = Instant.now().toEpochMilli() - 1000;
    assertThat(records.appendSpeech(an, "m1", "  chào  ", ts)).isTrue();

    MeetingRecord r = records.list("m1").get(0);
    assertThat(r.getText()).isEqualTo("chào");
    assertThat(r.getKind()).isEqualTo(MeetingRecord.Kind.SPEECH);
    assertThat(r.getDisplayName()).isEqualTo("An");
    assertThat(r.getUserId()).isEqualTo("a");
    assertThat(r.getMeetingId()).isEqualTo("m1");
    assertThat(r.getTs().toEpochMilli()).isEqualTo(ts);
  }

  @Test
  void storesNullNameWhenNoProfile() {
    when(people.profiles(anyCollection())).thenReturn(Map.of());
    assertThat(records.appendSpeech(an, "m1", "hi", null)).isTrue();
    assertThat(records.list("m1").get(0).getDisplayName()).isNull();
  }

  @Test
  void cutsAt500Chars() {
    assertThat(records.appendSpeech(an, "m1", "a".repeat(600), null)).isTrue();
    assertThat(records.list("m1").get(0).getText()).hasSize(500);
  }

  @Test
  void dropsBlank() {
    assertThat(records.appendSpeech(an, "m1", "   ", null)).isFalse();
    assertThat(records.appendSpeech(an, "m1", null, null)).isFalse();
    assertThat(count()).isZero();
  }

  @Test
  void dropsWhenAiNotesOff() {
    when(guard.inRoom(an, "m1")).thenReturn(meeting(false));
    assertThat(records.appendSpeech(an, "m1", "hi", null)).isFalse();
    assertThat(count()).isZero();
  }

  @Test
  void dropsWhenSpeakerAlreadyLeft() {
    when(guard.inRoom(an, "m1")).thenReturn(meeting(true, Instant.now()));
    assertThat(records.appendSpeech(an, "m1", "hi", null)).isFalse();
    assertThat(count()).isZero();
  }

  @Test
  void dropsWhenSpeakerHasNoAttendanceRow() {
    Meeting m = meeting(true);
    m.setAttendance(new java.util.ArrayList<>());
    when(guard.inRoom(an, "m1")).thenReturn(m);
    assertThat(records.appendSpeech(an, "m1", "hi", null)).isFalse();
  }

  @Test
  void dropsWhenCallerNotInRoom() {
    doThrow(
            new ApiException(
                HttpStatus.FORBIDDEN, "MEETING_FORBIDDEN", null, (Map<String, Object>) null))
        .when(guard)
        .inRoom(an, "m1");
    assertThat(records.appendSpeech(an, "m1", "hi", null)).isFalse();
    assertThat(count()).isZero();
  }

  @Test
  void clampsClientTimestampToServerNow() {
    long future = Instant.now().plusSeconds(3600).toEpochMilli();
    assertThat(records.appendSpeech(an, "m1", "hi", future)).isTrue();
    assertThat(records.list("m1").get(0).getTs()).isBeforeOrEqualTo(Instant.now());
  }

  @Test
  void listReturnsInTsOrder() {
    long now = Instant.now().toEpochMilli();
    records.appendSpeech(an, "m1", "second", now - 1000);
    records.appendSpeech(an, "m1", "first", now - 5000);
    records.appendSpeech(an, "m1", "third", now - 10);
    assertThat(records.list("m1"))
        .extracting(MeetingRecord::getText)
        .containsExactly("first", "second", "third");
    assertThat(records.list("other")).isEqualTo(List.of());
  }
}
