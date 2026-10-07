package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.MeetingNoteDto;
import com.platform.chatservice.dto.meeting.MeetingNoteRequest;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.MeetingNoteConflictException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingNote;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.meeting.MeetingNotesService.Scope;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataMongoTest
@Testcontainers
class MeetingNotesServiceTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  @Autowired private MongoTemplate template;
  @Autowired private MongoMappingContext mappingContext;
  private MeetingGuard guard;
  private MeetingEvents events;
  private MeetingNotesService notes;
  private Meeting m;

  private final UserPrincipal host = new UserPrincipal("host");
  private final UserPrincipal hoa = new UserPrincipal("inv");

  @BeforeEach
  void setUp() {
    template.dropCollection(MeetingNote.class);
    IndexOperations ops = template.indexOps(MeetingNote.class);
    new MongoPersistentEntityIndexResolver(mappingContext)
        .resolveIndexFor(MeetingNote.class)
        .forEach(ops::ensureIndex);

    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .inviteeIds(new ArrayList<>(List.of("inv")))
            .build();
    guard = mock(MeetingGuard.class);
    when(guard.records(any(), eq("m1"))).thenReturn(m);
    MeetingPeople people = mock(MeetingPeople.class);
    when(people.profiles(anyCollection()))
        .thenReturn(
            Map.of(
                "host", new PersonDto("host", "Lan", null),
                "inv", new PersonDto("inv", "Hoa", null)));
    events = mock(MeetingEvents.class);
    notes = new MeetingNotesService(template, guard, people, events);
  }

  private static MeetingNoteRequest req(String content, Long version) {
    return new MeetingNoteRequest(content, version);
  }

  private static ApiException apiError(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e;
    }
    throw new AssertionError("expected ApiException");
  }

  private static MeetingNoteConflictException conflict(Runnable r) {
    ApiException e = apiError(r);
    assertThat(e).isInstanceOf(MeetingNoteConflictException.class);
    assertThat(e.status()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(e.code()).isEqualTo("MEETING_NOTE_CONFLICT");
    return (MeetingNoteConflictException) e;
  }

  @Test
  void beforeAnyoneWritesTheNoteIsEmptyAtVersionZero() {
    assertThat(notes.get(host, "m1", Scope.SHARED))
        .isEqualTo(new MeetingNoteDto("shared", "", 0, null, null));
    assertThat(notes.get(host, "m1", Scope.PRIVATE).scope()).isEqualTo("private");
  }

  @Test
  void theFirstSaveCreatesVersionOneAndTellsTheRoom() {
    MeetingNoteDto saved = notes.put(host, "m1", Scope.SHARED, req("# Agenda\n", 0L));

    assertThat(saved.version()).isEqualTo(1);
    assertThat(saved.content()).isEqualTo("# Agenda\n"); // kept verbatim, never trimmed
    assertThat(saved.updatedBy()).isEqualTo(new PersonDto("host", "Lan", null));
    assertThat(saved.updatedAt()).isNotNull();
    verify(events).notesUpdated("m1", 1, new PersonDto("host", "Lan", null));
    assertThat(notes.get(hoa, "m1", Scope.SHARED).content()).isEqualTo("# Agenda\n");
  }

  @Test
  void savingOnTheLatestVersionBumpsIt() {
    notes.put(host, "m1", Scope.SHARED, req("A", 0L));
    MeetingNoteDto second = notes.put(hoa, "m1", Scope.SHARED, req("B", 1L));

    assertThat(second.version()).isEqualTo(2);
    assertThat(second.updatedBy().displayName()).isEqualTo("Hoa");
    assertThat(notes.get(host, "m1", Scope.SHARED).content()).isEqualTo("B");
  }

  @Test
  void aStaleVersionIs409WithTheLatestAndChangesNothing() {
    notes.put(host, "m1", Scope.SHARED, req("A", 0L));
    notes.put(hoa, "m1", Scope.SHARED, req("B", 1L));

    MeetingNoteConflictException e =
        conflict(() -> notes.put(host, "m1", Scope.SHARED, req("C", 1L)));

    assertThat(e.getLatest().content()).isEqualTo("B");
    assertThat(e.getLatest().version()).isEqualTo(2);
    assertThat(e.getLatest().updatedBy().displayName()).isEqualTo("Hoa");
    assertThat(notes.get(host, "m1", Scope.SHARED).content()).isEqualTo("B");
  }

  @Test
  void twoFirstSavesRaceAndTheLoserSeesTheWinnersText() {
    notes.put(host, "m1", Scope.SHARED, req("A", 0L));

    MeetingNoteConflictException e =
        conflict(() -> notes.put(hoa, "m1", Scope.SHARED, req("B", 0L)));

    assertThat(e.getLatest().content()).isEqualTo("A");
    assertThat(e.getLatest().version()).isEqualTo(1);
  }

  @Test
  void concurrentSavesOnTheSameVersionHaveExactlyOneWinner() throws Exception {
    notes.put(host, "m1", Scope.SHARED, req("base", 0L));
    ExecutorService pool = Executors.newFixedThreadPool(8);
    AtomicInteger wins = new AtomicInteger();
    AtomicInteger conflicts = new AtomicInteger();
    List<Future<?>> done = new ArrayList<>();
    for (int i = 0; i < 8; i++) {
      String text = "w" + i;
      Callable<Void> save =
          () -> {
            try {
              notes.put(host, "m1", Scope.SHARED, req(text, 1L));
              wins.incrementAndGet();
            } catch (MeetingNoteConflictException e) {
              conflicts.incrementAndGet();
            }
            return null;
          };
      done.add(pool.submit(save));
    }
    for (Future<?> f : done) {
      f.get();
    }
    pool.shutdown();

    assertThat(wins.get()).isEqualTo(1);
    assertThat(conflicts.get()).isEqualTo(7);
    assertThat(notes.get(host, "m1", Scope.SHARED).version()).isEqualTo(2);
  }

  @Test
  void privateNotesBelongToTheirOwnerAndAreNeverAnnounced() {
    notes.put(host, "m1", Scope.PRIVATE, req("mine", 0L));
    notes.put(hoa, "m1", Scope.PRIVATE, req("theirs", 0L)); // own document, no conflict

    assertThat(notes.get(host, "m1", Scope.PRIVATE).content()).isEqualTo("mine");
    assertThat(notes.get(hoa, "m1", Scope.PRIVATE).content()).isEqualTo("theirs");
    assertThat(notes.get(host, "m1", Scope.SHARED).version()).isZero();
    verify(events, never()).notesUpdated(anyString(), anyLong(), any());
  }

  @Test
  void attendeesCannotEditTheSharedNoteWhenTheHostTurnedItOff() {
    m.getSettings().setAttendeesCanEditNotes(false);

    ApiException e = apiError(() -> notes.put(hoa, "m1", Scope.SHARED, req("x", 0L)));
    assertThat(e.status()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(e.code()).isEqualTo("MEETING_NOTES_READ_ONLY");

    assertThat(notes.put(host, "m1", Scope.SHARED, req("ok", 0L)).version()).isEqualTo(1);
    assertThat(notes.put(hoa, "m1", Scope.PRIVATE, req("own", 0L)).version()).isEqualTo(1);
  }

  @Test
  void contentAndVersionAreValidated() {
    assertThat(apiError(() -> notes.put(host, "m1", Scope.SHARED, req(null, 0L))).getParams())
        .isEqualTo(Map.of("field", "content"));
    assertThat(
            apiError(() -> notes.put(host, "m1", Scope.SHARED, req("x".repeat(50_001), 0L)))
                .getParams())
        .isEqualTo(Map.of("field", "content", "max", 50_000));
    assertThat(apiError(() -> notes.put(host, "m1", Scope.SHARED, req("x", null))).getParams())
        .isEqualTo(Map.of("field", "version"));
    assertThat(apiError(() -> notes.put(host, "m1", Scope.SHARED, req("x", -1L))).getParams())
        .isEqualTo(Map.of("field", "version"));
    assertThat(apiError(() -> notes.put(host, "m1", Scope.SHARED, null)).code())
        .isEqualTo("MEETING_INVALID");

    assertThat(notes.put(host, "m1", Scope.SHARED, req("x".repeat(50_000), 0L)).version())
        .isEqualTo(1);
    assertThat(notes.put(host, "m1", Scope.SHARED, req("", 1L)).content()).isEmpty();
  }

  @Test
  void theNotesOfAnEndedMeetingStayEditable() {
    m.setStatus(MeetingStatus.ENDED);
    assertThat(notes.put(host, "m1", Scope.SHARED, req("minutes", 0L)).version()).isEqualTo(1);
  }

  @Test
  void theGuardDecidesWhoMayReadAndWrite() {
    when(guard.records(any(), eq("m2")))
        .thenThrow(new ApiException(HttpStatus.FORBIDDEN, "MEETING_REMOVED"));

    assertThat(apiError(() -> notes.get(hoa, "m2", Scope.SHARED)).code())
        .isEqualTo("MEETING_REMOVED");
    assertThat(apiError(() -> notes.put(hoa, "m2", Scope.SHARED, req("x", 0L))).code())
        .isEqualTo("MEETING_REMOVED");
    assertThat(template.findAll(MeetingNote.class)).isEmpty();
  }
}
