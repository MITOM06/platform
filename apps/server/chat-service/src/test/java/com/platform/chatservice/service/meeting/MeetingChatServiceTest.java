package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.meeting.MeetingChatCommand;
import com.platform.chatservice.dto.meeting.MeetingMessageDto;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.RateLimitExceededException;
import com.platform.chatservice.model.MeetingAttachment;
import com.platform.chatservice.model.MeetingMessage;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.RateLimiterService;
import com.platform.chatservice.service.upload.UploadRefs;
import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
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
  @Autowired private MongoMappingContext mappingContext;
  private MeetingGuard guard;
  private MeetingPeople people;
  private MeetingEvents events;
  private RateLimiterService rateLimiter;
  private MeetingChatService chat;
  private MeetingAiBridge aiBridge;
  private GridFsTemplate gridFs;
  private UploadRefs uploadRefs;
  private MeetingMaterialTrigger materials;
  private final UserPrincipal an = new UserPrincipal("a");

  @BeforeEach
  void setUp() {
    template.dropCollection(MeetingMessage.class);
    // The indexes MongoIndexInitializer creates from the model's annotations.
    IndexOperations ops = template.indexOps(MeetingMessage.class);
    new MongoPersistentEntityIndexResolver(mappingContext)
        .resolveIndexFor(MeetingMessage.class)
        .forEach(ops::ensureIndex);
    guard = mock(MeetingGuard.class);
    people = mock(MeetingPeople.class);
    events = mock(MeetingEvents.class);
    rateLimiter = mock(RateLimiterService.class);
    when(people.profiles(anyCollection())).thenReturn(Map.of("a", new PersonDto("a", "An", null)));
    aiBridge = mock(MeetingAiBridge.class);
    gridFs = new GridFsTemplate(template.getMongoDatabaseFactory(), template.getConverter());
    uploadRefs = mock(UploadRefs.class);
    materials = mock(MeetingMaterialTrigger.class);
    chat =
        new MeetingChatService(
            template,
            guard,
            people,
            events,
            rateLimiter,
            aiBridge,
            new MeetingAttachments(gridFs, uploadRefs),
            materials);
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
  void theSameClientIdTwiceStoresOneLineAndReEchoesItToTheSenderOnly() {
    MeetingMessageDto first = chat.send(an, "m1", "hello", "c-1");
    MeetingMessageDto again = chat.send(an, "m1", "hello", "c-1");

    assertThat(count()).isEqualTo(1);
    assertThat(again).isEqualTo(first);
    assertThat(template.findById(first.id(), MeetingMessage.class).getClientId()).isEqualTo("c-1");
    verify(events, times(1)).chat("m1", first, "c-1");
    verify(events).chatToSender("a", "m1", first, "c-1");
    verify(rateLimiter, times(1)).checkMessageRate("a"); // the replay costs nothing
  }

  @Test
  void differentClientIdsSendersOrMeetingsAreDifferentLines() {
    chat.send(an, "m1", "hello", "c-1");
    chat.send(an, "m1", "hello", "c-2");
    chat.send(new UserPrincipal("b"), "m1", "hello", "c-1");
    chat.send(an, "m2", "hello", "c-1");

    assertThat(count()).isEqualTo(4);
    verify(events, never()).chatToSender(any(), any(), any(), any());
  }

  @Test
  void linesWithoutAClientIdAreNeverDeduplicated() {
    chat.send(an, "m1", "hello", null);
    chat.send(an, "m1", "hello", null);
    chat.send(an, "m1", "hello", "bad id"); // malformed = absent

    assertThat(count()).isEqualTo(3);
    assertThat(template.findAll(MeetingMessage.class))
        .allSatisfy(m -> assertThat(m.getClientId()).isNull());
    verify(events, never()).chatToSender(any(), any(), any(), any());
  }

  @Test
  void concurrentSendsWithTheSameClientIdStoreOneLine() throws Exception {
    int n = 8;
    ExecutorService pool = Executors.newFixedThreadPool(n);
    CountDownLatch go = new CountDownLatch(1);
    try {
      List<Future<MeetingMessageDto>> sends = new ArrayList<>();
      for (int i = 0; i < n; i++) {
        sends.add(
            pool.submit(
                () -> {
                  go.await();
                  return chat.send(an, "m1", "hello", "c-race");
                }));
      }
      go.countDown();
      List<String> ids = new ArrayList<>();
      for (Future<MeetingMessageDto> f : sends) {
        ids.add(f.get(30, TimeUnit.SECONDS).id());
      }

      assertThat(count()).isEqualTo(1);
      assertThat(ids).containsOnly(template.findAll(MeetingMessage.class).get(0).getId());
      verify(events, times(1)).chat(eq("m1"), any(), eq("c-race"));
      verify(events, times(n - 1)).chatToSender(eq("a"), eq("m1"), any(), eq("c-race"));
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  void aDuplicateKeyFromARacingSendTakesTheReplayPath() {
    // The racing send lands between this send's lookup and its insert.
    doAnswer(
            inv -> {
              template.insert(
                  MeetingMessage.builder()
                      .id(ID1)
                      .meetingId("m1")
                      .senderId("a")
                      .content("hello")
                      .clientId("c-late")
                      .createdAt(Instant.now())
                      .build());
              return null;
            })
        .when(rateLimiter)
        .checkMessageRate("a");

    MeetingMessageDto dto = chat.send(an, "m1", "hello", "c-late");

    assertThat(dto.id()).isEqualTo(ID1);
    assertThat(count()).isEqualTo(1);
    verify(events, never()).chat(any(), any(), any());
    verify(events).chatToSender("a", "m1", dto, "c-late");
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

  @Test
  void aLineWithAMentionAsksTheAiAfterTheRoomSawIt() {
    chat.send(an, "m1", "  @AI summarise  ", null);

    org.mockito.InOrder order = org.mockito.Mockito.inOrder(events, aiBridge);
    order.verify(events).chat(eq("m1"), any(), isNull());
    order.verify(aiBridge).ask(an, "m1", "@AI summarise");
  }

  @Test
  void aLineWithoutAMentionNeverAsksTheAi() {
    chat.send(an, "m1", "just talking", null);

    verifyNoInteractions(aiBridge);
  }

  /** Stores a GridFS upload like UploadController does; returns its id. */
  private String upload(String uploadedBy, byte[] bytes, String contentType) {
    String id = UUID.randomUUID().toString();
    gridFs.store(
        new ByteArrayInputStream(bytes),
        id,
        contentType,
        new Document("fileId", id).append("uploadedBy", uploadedBy));
    return id;
  }

  private static MeetingChatCommand.Attachment att(String id, String name) {
    return new MeetingChatCommand.Attachment("/api/uploads/" + id, name, 999L, "text/evil");
  }

  private static void assertInvalidAttachment(ApiException e) {
    assertThat(e.status()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(e.code()).isEqualTo("MEETING_INVALID");
    assertThat(e.getParams()).isEqualTo(Map.of("field", "attachment"));
  }

  @Test
  void aValidAttachmentIsStoredWithTheRealSizeAndTypeAndOpenedToTheMeeting() {
    String id = upload("a", new byte[] {1, 2, 3, 4, 5}, "application/pdf");

    MeetingMessageDto dto = chat.send(an, "m1", "see this", "c-1", att(id, "  plan.pdf "));

    assertThat(dto.attachment().url()).isEqualTo("/api/uploads/" + id);
    assertThat(dto.attachment().name()).isEqualTo("plan.pdf");
    assertThat(dto.attachment().size()).isEqualTo(5);
    assertThat(dto.attachment().contentType()).isEqualTo("application/pdf");
    MeetingAttachment saved = template.findById(dto.id(), MeetingMessage.class).getAttachment();
    assertThat(saved.getUploadId()).isEqualTo(id);
    assertThat(saved.getSize()).isEqualTo(5);
    verify(guard).inRoom(an, "m1");
    verify(uploadRefs).attachToMeeting(id, "m1", "a");
    verify(events).chat("m1", dto, "c-1");
    verify(materials).onFileSent("m1", dto.id(), saved, "a");
  }

  @Test
  void anotherUsersFileABadUrlOrAMissingFileIsInvalid() {
    String theirs = upload("someone-else", new byte[] {1}, "text/plain");
    String missing = UUID.randomUUID().toString();
    List<MeetingChatCommand.Attachment> bad =
        List.of(
            att(theirs, "x.txt"),
            att(missing, "x.txt"),
            new MeetingChatCommand.Attachment("https://evil.example/a.txt", "x", null, null),
            new MeetingChatCommand.Attachment("/api/uploads/" + theirs + "?t=1", "x", null, null),
            new MeetingChatCommand.Attachment("/api/uploads/" + theirs + "#f", "x", null, null),
            new MeetingChatCommand.Attachment(
                "https://pon.example.com/api/uploads/" + theirs, "x", null, null),
            new MeetingChatCommand.Attachment(
                "//evil.example/api/uploads/" + theirs, "x", null, null),
            new MeetingChatCommand.Attachment("/api/uploads/../" + theirs, "x", null, null),
            new MeetingChatCommand.Attachment(null, "x", null, null),
            att(upload("a", new byte[] {1}, "text/plain"), " "),
            att(upload("a", new byte[] {1}, "text/plain"), "n".repeat(201)));

    for (MeetingChatCommand.Attachment a : bad) {
      assertInvalidAttachment(apiError(() -> chat.send(an, "m1", "hi", null, a)));
    }
    assertThat(count()).isZero();
    verify(uploadRefs, never()).attachToMeeting(any(), any(), any());
    verify(materials, never()).onFileSent(any(), any(), any(), any());
  }

  @Test
  void bidiAndControlCharactersAreStrippedFromTheClientName() {
    String id = upload("a", new byte[] {1}, "application/pdf");

    MeetingMessageDto dto =
        chat.send(an, "m1", "x", null, att(id, "invoice\u202Efdp.exe\u0000\n\u200B"));

    assertThat(dto.attachment().name()).isEqualTo("invoicefdp.exe");
  }

  @Test
  void theStoredOriginalFilenameWinsOverTheClientName() {
    String id = UUID.randomUUID().toString();
    gridFs.store(
        new ByteArrayInputStream(new byte[] {1}),
        id,
        "application/pdf",
        new Document("fileId", id)
            .append("uploadedBy", "a")
            .append("originalFilename", "real\u202E.pdf"));

    MeetingMessageDto dto = chat.send(an, "m1", "x", null, att(id, "fake.exe"));

    assertThat(dto.attachment().name()).isEqualTo("real.pdf");
  }

  @Test
  void emptyTextWithAFileIsFineButEmptyTextAloneStillFails() {
    String id = upload("a", new byte[] {1}, "text/plain");

    MeetingMessageDto dto = chat.send(an, "m1", "   ", null, att(id, "n.txt"));

    assertThat(dto.content()).isEmpty();
    assertThat(dto.attachment()).isNotNull();
    assertThat(apiError(() -> chat.send(an, "m1", "  ", null, null)).getParams())
        .isEqualTo(Map.of("field", "content"));
  }

  @Test
  void replayingAFileLineDoesNotAttachOrTriggerTwice() {
    String id = upload("a", new byte[] {1}, "text/plain");
    MeetingMessageDto first = chat.send(an, "m1", "x", "c-1", att(id, "n.txt"));
    MeetingMessageDto again = chat.send(an, "m1", "x", "c-1", att(id, "n.txt"));

    assertThat(again.id()).isEqualTo(first.id());
    assertThat(again.attachment()).isEqualTo(first.attachment());
    assertThat(count()).isEqualTo(1);
    verify(uploadRefs, times(1)).attachToMeeting(any(), any(), any());
    verify(materials, times(1)).onFileSent(any(), any(), any(), any());
    verify(events, times(1)).chat(any(), any(), any());
  }

  @Test
  void historyCarriesTheAttachment() {
    String id = upload("a", new byte[] {1, 2}, "image/png");
    chat.send(an, "m1", "pic", null, att(id, "p.png"));
    when(guard.records(any(), any())).thenReturn(null);

    PageResponse<MeetingMessageDto> page = chat.history(an, "m1", null, 10);

    assertThat(page.content()).hasSize(1);
    assertThat(page.content().get(0).attachment().name()).isEqualTo("p.png");
    assertThat(page.content().get(0).attachment().size()).isEqualTo(2);
  }
}
