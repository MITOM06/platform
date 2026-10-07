package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.meeting.MeetingMessageDto;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.RateLimitExceededException;
import com.platform.chatservice.model.MeetingMessage;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.RateLimiterService;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataMongoTest
@Testcontainers
class MeetingChatServiceTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  private static final String ID1 = "64b000000000000000000001";
  private static final String ID2 = "64b000000000000000000002";
  private static final String ID3 = "64b000000000000000000003";
  private static final String ID4 = "64b000000000000000000004";
  private static final String OTHER = "64b000000000000000000009";

  @Autowired private MongoTemplate template;
  private MeetingGuard guard;
  private MeetingPeople people;
  private MeetingEvents events;
  private RateLimiterService rateLimiter;
  private MeetingChatService chat;
  private final UserPrincipal an = new UserPrincipal("a");

  @BeforeEach
  void setUp() {
    template.dropCollection(MeetingMessage.class);
    guard = mock(MeetingGuard.class);
    people = mock(MeetingPeople.class);
    events = mock(MeetingEvents.class);
    rateLimiter = mock(RateLimiterService.class);
    when(people.profiles(anyCollection())).thenReturn(Map.of("a", new PersonDto("a", "An", null)));
    chat = new MeetingChatService(template, guard, people, events, rateLimiter);
  }

  private void stored(String id, String meetingId, Instant at) {
    template.insert(
        MeetingMessage.builder()
            .id(id)
            .meetingId(meetingId)
            .senderId("a")
            .content("t-" + id)
            .createdAt(at)
            .build());
  }

  private long count() {
    return template.count(new Query(), MeetingMessage.class);
  }

  private static ApiException apiError(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e;
    }
    throw new AssertionError("expected ApiException");
  }

  @Test
  void sendStoresTrimmedTextAndTellsTheRoomWithTheSendersName() {
    MeetingMessageDto dto = chat.send(an, "m1", "  hello  ", "c-1");

    assertThat(dto.id()).isNotBlank();
    assertThat(dto.content()).isEqualTo("hello");
    assertThat(dto.sender()).isEqualTo(new PersonDto("a", "An", null));
    MeetingMessage saved = template.findById(dto.id(), MeetingMessage.class);
    assertThat(saved.getMeetingId()).isEqualTo("m1");
    assertThat(saved.getSenderId()).isEqualTo("a");
    assertThat(saved.getContent()).isEqualTo("hello");
    verify(guard).inRoom(an, "m1");
    verify(rateLimiter).checkMessageRate("a");
    verify(events).chat("m1", dto, "c-1");
  }

  @Test
  void aMalformedClientIdIsDroppedNotRefused() {
    chat.send(an, "m1", "hi", "has space");
    chat.send(an, "m1", "hi", "x".repeat(65));

    verify(events, times(2)).chat(eq("m1"), any(), isNull());
    assertThat(count()).isEqualTo(2);
  }

  @Test
  void emptyOrTooLongIsRefusedBeforeTheRateLimitAndNothingIsStored() {
    for (String bad : new String[] {null, "", "   "}) {
      ApiException e = apiError(() -> chat.send(an, "m1", bad, null));
      assertThat(e.status()).isEqualTo(HttpStatus.BAD_REQUEST);
      assertThat(e.code()).isEqualTo("MEETING_INVALID");
      assertThat(e.getParams()).isEqualTo(Map.of("field", "content"));
    }
    assertThat(apiError(() -> chat.send(an, "m1", "x".repeat(2001), null)).getParams())
        .isEqualTo(Map.of("field", "content", "max", 2000));
    assertThat(count()).isZero();
    verify(rateLimiter, never()).checkMessageRate(any());

    chat.send(an, "m1", "x".repeat(2000), null); // the limit itself is fine
    assertThat(count()).isEqualTo(1);
  }

  @Test
  void theGuardDecidesWhoMayTalk() {
    when(guard.inRoom(any(), eq("m1")))
        .thenThrow(new ApiException(HttpStatus.FORBIDDEN, "MEETING_REMOVED"));

    assertThat(apiError(() -> chat.send(an, "m1", "hi", null)).code()).isEqualTo("MEETING_REMOVED");
    assertThat(count()).isZero();
    verifyNoInteractions(events, rateLimiter);
  }

  @Test
  void aRateLimitedSendIsNotStored() {
    doThrow(new RateLimitExceededException()).when(rateLimiter).checkMessageRate("a");

    assertThatThrownBy(() -> chat.send(an, "m1", "hi", null))
        .isInstanceOf(RateLimitExceededException.class);
    assertThat(count()).isZero();
    verifyNoInteractions(events);
  }

  @Test
  void historyIsNewestFirstAndTheCursorNeverSkipsATimestampTie() {
    Instant t = Instant.parse("2026-10-08T02:00:00Z");
    stored(ID1, "m1", t);
    stored(ID2, "m1", t);
    stored(ID3, "m1", t);
    stored(ID4, "m1", t.plusSeconds(1));
    stored(OTHER, "m2", t.plusSeconds(5));

    PageResponse<MeetingMessageDto> first = chat.history(an, "m1", null, 2);
    assertThat(first.content()).extracting(MeetingMessageDto::id).containsExactly(ID4, ID3);
    assertThat(first.hasNext()).isTrue();
    assertThat(first.content().get(0).sender().displayName()).isEqualTo("An");

    PageResponse<MeetingMessageDto> second = chat.history(an, "m1", ID3, 2);
    assertThat(second.content()).extracting(MeetingMessageDto::id).containsExactly(ID2, ID1);
    assertThat(second.hasNext()).isFalse();
  }

  @Test
  void aCursorFromAnotherMeetingOrUnknownGivesAnEmptyPage() {
    stored(OTHER, "m2", Instant.now());

    assertThat(chat.history(an, "m1", OTHER, 10).content()).isEmpty();
    assertThat(chat.history(an, "m1", "64b0000000000000000000ff", 10).content()).isEmpty();
  }

  @Test
  void historyNeedsRecordAccessAndLooksNamesUpOncePerPage() {
    Instant t = Instant.parse("2026-10-08T02:00:00Z");
    stored(ID1, "m1", t);
    stored(ID2, "m1", t.plusSeconds(1));

    chat.history(an, "m1", null, 10);

    verify(guard).records(an, "m1");
    verify(guard, never()).inRoom(any(), any());
    verify(people, times(1)).profiles(anyCollection());
  }
}
