package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.MeetingRecordView;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingAttachment;
import com.platform.chatservice.model.MeetingMessage;
import com.platform.chatservice.model.MeetingNote;
import com.platform.chatservice.model.MeetingRecord;
import com.platform.chatservice.service.AiConstants;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataMongoTest
@Testcontainers
class MeetingRecordReaderTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  private static final String MID = "m1";
  private static final String HOST = "64b000000000000000000001";
  private static final String LAN = "64b000000000000000000002";
  private static final String DEPT_USER = "64b000000000000000000003";
  private static final String OUTSIDER = "64b000000000000000000004";
  private static final String REMOVED = "64b000000000000000000005";
  private static final String DEPT = "66aa00000000000000000009";
  private static final Instant T0 = Instant.parse("2026-11-05T10:00:00Z");

  @Autowired private MongoTemplate template;
  private MeetingStore store;
  private MeetingLobby lobby;
  private MeetingSummaryStore summaries;
  private MeetingRecordReader reader;

  @BeforeEach
  void setUp() {
    template.dropCollection(MeetingRecord.class);
    template.dropCollection(MeetingMessage.class);
    template.dropCollection(MeetingNote.class);
    template.dropCollection("users");
    store = mock(MeetingStore.class);
    lobby = mock(MeetingLobby.class);
    summaries = mock(MeetingSummaryStore.class);
    MeetingPeople people = new MeetingPeople(template);
    reader =
        new MeetingRecordReader(
            store,
            lobby,
            template,
            people,
            new MeetingRecordService(template, null, people),
            summaries);
    template.insert(user(HOST, "Host Ha", List.of()), "users");
    template.insert(user(LAN, "Lan Nguyen", List.of()), "users");
    template.insert(user(DEPT_USER, "Dung", List.of(new ObjectId(DEPT))), "users");
    template.insert(user(OUTSIDER, "Out Sider", List.of()), "users");
    template.insert(user(REMOVED, "Rem Oved", List.of()), "users");
    when(store.findById(MID)).thenReturn(Optional.of(meeting()));
  }

  private static Document user(String id, String name, List<ObjectId> depts) {
    return new Document("_id", new ObjectId(id))
        .append("displayName", name)
        .append("departmentIds", depts);
  }

  private static Meeting meeting() {
    return Meeting.builder()
        .id(MID)
        .code("abc-defg-hjk")
        .title("Sync")
        .hostId(HOST)
        .departmentId(DEPT)
        .removedIds(new ArrayList<>(List.of(REMOVED)))
        .startedAt(T0)
        .endedAt(T0.plusSeconds(600))
        .attendance(
            new ArrayList<>(
                List.of(
                    Meeting.Attendance.builder().userId(LAN).displayName("Lan Nguyen").build(),
                    Meeting.Attendance.builder().userId(LAN).displayName("Lan Nguyen").build(),
                    Meeting.Attendance.builder().userId(HOST).displayName("Host Ha").build())))
        .build();
  }

  private void speech(int i) {
    template.insert(
        MeetingRecord.builder()
            .meetingId(MID)
            .kind(MeetingRecord.Kind.SPEECH)
            .userId(LAN)
            .displayName("Lan Nguyen")
            .text("line " + i)
            .ts(T0.plusMillis(i))
            .build());
  }

  @Test
  void outsiderAndRemovedAndBlankAndUnknownMeetingGetNothing() {
    assertThat(reader.read(MID, OUTSIDER)).isEmpty();
    assertThat(reader.read(MID, REMOVED)).isEmpty();
    assertThat(reader.read(MID, "")).isEmpty();
    assertThat(reader.read(MID, null)).isEmpty();
    assertThat(reader.read("nope", HOST)).isEmpty();
  }

  @Test
  void aNoticeFileRecordWithoutAUserOrNameIsReadAsIs() {
    template.insert(
        MeetingRecord.builder()
            .meetingId(MID)
            .kind(MeetingRecord.Kind.FILE)
            .text("Đã đạt giới hạn file AI đọc.")
            .ts(T0)
            .build());

    List<MeetingRecordView.Rec> out = reader.read(MID, HOST).orElseThrow().records();

    assertThat(out).hasSize(1);
    assertThat(out.get(0).kind()).isEqualTo("FILE");
    assertThat(out.get(0).displayName()).isNull();
    assertThat(out.get(0).text()).isEqualTo("Đã đạt giới hạn file AI đọc.");
  }

  @Test
  void fileRecordsCarryTheFileNameAndChatLinesTheAttachmentName() {
    template.insert(
        MeetingRecord.builder()
            .meetingId(MID)
            .kind(MeetingRecord.Kind.FILE)
            .userId(LAN)
            .displayName("Lan Nguyen")
            .text("Bảng giá Q3")
            .fileName("gia.pdf")
            .ts(T0)
            .build());
    template.insert(
        MeetingMessage.builder()
            .meetingId(MID)
            .senderId(LAN)
            .content("xem nhé")
            .attachment(MeetingAttachment.builder().uploadId("u").name("plan.pdf").build())
            .createdAt(T0)
            .build());
    template.insert(
        MeetingMessage.builder()
            .meetingId(MID)
            .senderId(LAN)
            .content("plain")
            .createdAt(T0.plusSeconds(1))
            .build());

    MeetingRecordView view = reader.read(MID, HOST).orElseThrow();

    assertThat(view.records().get(0).fileName()).isEqualTo("gia.pdf");
    assertThat(view.chat().get(0).attachmentName()).isEqualTo("plan.pdf");
    assertThat(view.chat().get(1).attachmentName()).isNull();
  }

  @Test
  void removedUserIsRefusedEvenWhenAdmittedOrAttended() {
    when(lobby.isAdmitted(MID, REMOVED)).thenReturn(true);
    assertThat(reader.read(MID, REMOVED)).isEmpty();
  }

  @Test
  void recordIncludesLatestSummaryOrNull() {
    when(summaries.latest(MID)).thenReturn(Optional.empty());
    assertThat(reader.read(MID, HOST).orElseThrow().summary()).isNull();

    when(summaries.latest(MID))
        .thenReturn(
            Optional.of(
                com.platform.chatservice.model.MeetingSummaryDoc.builder()
                    .meetingId(MID)
                    .summary(java.util.Map.of("overview", "We shipped it"))
                    .build()));
    assertThat(reader.read(MID, HOST).orElseThrow().summary())
        .containsEntry("overview", "We shipped it");
  }

  @Test
  void departmentMemberCanRead() {
    Optional<MeetingRecordView> view = reader.read(MID, DEPT_USER);
    assertThat(view).isPresent();
  }

  @Test
  void admittedPersonCanRead() {
    when(lobby.isAdmitted(MID, OUTSIDER)).thenReturn(true);
    assertThat(reader.read(MID, OUTSIDER)).isPresent();
  }

  @Test
  void attendeeReadsRecordsChatAndNoteWithoutAnyUserId() throws Exception {
    speech(1);
    template.insert(
        MeetingMessage.builder()
            .meetingId(MID)
            .senderId(LAN)
            .content("hello")
            .createdAt(T0.plusSeconds(1))
            .build());
    template.insert(
        MeetingMessage.builder()
            .meetingId(MID)
            .senderId(AiConstants.AI_BOT_USER_ID)
            .content("bot says")
            .createdAt(T0.plusSeconds(2))
            .build());
    template.insert(
        MeetingMessage.builder()
            .meetingId(MID)
            .senderId(OUTSIDER.replace("4", "9"))
            .content("ghost")
            .createdAt(T0.plusSeconds(3))
            .build());
    template.insert(MeetingNote.builder().meetingId(MID).scope("SHARED").content("agenda").build());
    template.insert(
        MeetingNote.builder()
            .meetingId(MID)
            .scope("PRIVATE")
            .ownerId(LAN)
            .content("secret")
            .build());

    MeetingRecordView v = reader.read(MID, LAN).orElseThrow();

    assertThat(v.meeting().hostName()).isEqualTo("Host Ha");
    assertThat(v.meeting().title()).isEqualTo("Sync");
    assertThat(v.attendees())
        .extracting(MeetingRecordView.Attendee::displayName)
        .containsExactlyInAnyOrder("Lan Nguyen", "Host Ha");
    assertThat(v.records()).extracting(MeetingRecordView.Rec::text).containsExactly("line 1");
    assertThat(v.chat())
        .extracting(MeetingRecordView.Chat::content)
        .containsExactly("hello", "ghost");
    assertThat(v.chat())
        .extracting(MeetingRecordView.Chat::senderName)
        .containsExactly("Lan Nguyen", "Unknown");
    assertThat(v.sharedNote()).isEqualTo("agenda");

    String json =
        new com.fasterxml.jackson.databind.ObjectMapper()
            .findAndRegisterModules()
            .writeValueAsString(v);
    for (String id : List.of(HOST, LAN, DEPT_USER, OUTSIDER, REMOVED, AiConstants.AI_BOT_USER_ID)) {
      assertThat(json).doesNotContain(id);
    }
    assertThat(json).doesNotContain("secret");
  }

  @Test
  void missingSharedNoteIsNull() {
    assertThat(reader.read(MID, HOST).orElseThrow().sharedNote()).isNull();
  }

  @Test
  void capsRecordsToNewest4000() {
    List<MeetingRecord> rows = new ArrayList<>();
    for (int i = 0; i < 4001; i++) {
      rows.add(
          MeetingRecord.builder()
              .meetingId(MID)
              .kind(MeetingRecord.Kind.SPEECH)
              .displayName("Lan Nguyen")
              .text("line " + i)
              .ts(T0.plusMillis(i))
              .build());
    }
    template.insertAll(rows);

    List<MeetingRecordView.Rec> out = reader.read(MID, HOST).orElseThrow().records();

    assertThat(out).hasSize(4000);
    assertThat(out.get(0).text()).isEqualTo("line 1");
    assertThat(out.get(3999).text()).isEqualTo("line 4000");
    assertThat(out).extracting(MeetingRecordView.Rec::text).doesNotContain("line 0");
  }

  @Test
  void capsChatToNewest1000InAscendingOrder() {
    List<MeetingMessage> rows = new ArrayList<>();
    for (int i = 0; i < 1001; i++) {
      rows.add(
          MeetingMessage.builder()
              .meetingId(MID)
              .senderId(LAN)
              .content("msg " + i)
              .createdAt(T0.plusMillis(i))
              .build());
    }
    template.insertAll(rows);

    List<MeetingRecordView.Chat> out = reader.read(MID, HOST).orElseThrow().chat();

    assertThat(out).hasSize(1000);
    assertThat(out.get(0).content()).isEqualTo("msg 1");
    assertThat(out.get(999).content()).isEqualTo("msg 1000");
  }
}
