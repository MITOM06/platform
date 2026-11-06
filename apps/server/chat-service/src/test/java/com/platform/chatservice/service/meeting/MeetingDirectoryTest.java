package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;

import com.platform.chatservice.dto.meeting.MeetingListItem;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.model.MeetingSummaryState;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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
class MeetingDirectoryTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  private static final String HOST = "64b000000000000000000001";
  private static final String COHOST = "64b000000000000000000006";
  private static final String INVITEE = "64b000000000000000000002";
  private static final String ATTENDEE = "64b000000000000000000007";
  private static final String DEPT_USER = "64b000000000000000000003";
  private static final String OUTSIDER = "64b000000000000000000004";
  private static final String KICKED = "64b000000000000000000005";
  private static final String DEPT = "66aa00000000000000000009";
  private static final Instant T0 = Instant.parse("2026-11-05T10:00:00Z");

  @Autowired private MongoTemplate template;
  private MeetingDirectory directory;

  @BeforeEach
  void setUp() {
    template.dropCollection(Meeting.class);
    template.dropCollection("users");
    directory = new MeetingDirectory(template, new MeetingPeople(template));
    template.insert(
        new Document("_id", new ObjectId(DEPT_USER))
            .append("displayName", "Dung")
            .append("departmentIds", List.of(new ObjectId(DEPT))),
        "users");
  }

  private Meeting.MeetingBuilder base(String id, String title, int endedMinutes) {
    return Meeting.builder()
        .id(id)
        .code("code-" + id)
        .title(title)
        .hostId(HOST)
        .coHostIds(new ArrayList<>(List.of(COHOST)))
        .inviteeIds(new ArrayList<>(List.of(INVITEE)))
        .departmentId(DEPT)
        .status(MeetingStatus.ENDED)
        .aiNotesEverEnabled(true)
        .summaryState(MeetingSummaryState.DONE)
        .startedAt(T0)
        .endedAt(T0.plusSeconds(60L * endedMinutes))
        .attendance(
            new ArrayList<>(
                List.of(Meeting.Attendance.builder().userId(ATTENDEE).displayName("A").build())))
        .removedIds(new ArrayList<>(List.of(KICKED)));
  }

  @Test
  void listReturnsOnlyReadableEndedAiMeetings() {
    template.insert(base("ok", "Weekly sync", 10).build());
    template.insert(base("live", "Still going", 20).status(MeetingStatus.LIVE).build());
    template.insert(base("noai", "No AI", 30).aiNotesEverEnabled(false).build());

    for (String reader : List.of(HOST, COHOST, INVITEE, ATTENDEE, DEPT_USER)) {
      assertThat(directory.listReadable(reader, null, 20))
          .extracting(MeetingListItem::id)
          .as(reader)
          .containsExactly("ok");
    }
    assertThat(directory.listReadable(OUTSIDER, null, 20)).isEmpty();
    assertThat(directory.listReadable(KICKED, null, 20)).isEmpty();
    // a removed user who is also in the department / attended is still refused
    template.insert(
        base("kicked-attended", "Kicked", 40)
            .attendance(
                new ArrayList<>(List.of(Meeting.Attendance.builder().userId(KICKED).build())))
            .build());
    assertThat(directory.listReadable(KICKED, null, 20)).isEmpty();
  }

  @Test
  void listItemCarriesFieldsAndNewestFirst() {
    template.insert(base("old", "Old", 5).build());
    template.insert(base("new", "New", 50).summaryState(null).build());
    List<MeetingListItem> items = directory.listReadable(HOST, null, 20);
    assertThat(items).extracting(MeetingListItem::id).containsExactly("new", "old");
    assertThat(items.get(0).summaryState()).isNull();
    assertThat(items.get(1).summaryState()).isEqualTo("DONE");
    assertThat(items.get(1).code()).isEqualTo("code-old");
    assertThat(items.get(1).endedAt()).isEqualTo(T0.plusSeconds(300));
  }

  @Test
  void listFiltersByTitleCaseInsensitiveAndEscapesRegex() {
    template.insert(base("a", "Weekly Sync", 10).build());
    template.insert(base("b", "Budget (Q4) review", 20).build());
    template.insert(base("c", "Retro", 30).title(null).build());

    assertThat(directory.listReadable(HOST, "weekly", 20))
        .extracting(MeetingListItem::id)
        .containsExactly("a");
    assertThat(directory.listReadable(HOST, ".*", 20)).isEmpty();
    assertThat(directory.listReadable(HOST, "(q4)", 20))
        .extracting(MeetingListItem::id)
        .containsExactly("b");
    assertThat(directory.listReadable(HOST, "   ", 20)).hasSize(3);
  }

  @Test
  void listCapsLimitAt50AndDefaults20() {
    for (int i = 0; i < 60; i++) {
      template.insert(base("m" + i, "T" + i, i).build());
    }
    assertThat(directory.listReadable(HOST, null, 1000)).hasSize(50);
    assertThat(directory.listReadable(HOST, null, 0)).hasSize(1);
    assertThat(directory.listReadable(HOST, null, 7)).hasSize(7);
  }

  @Test
  void blankUserGetsNothing() {
    template.insert(base("ok", "x", 1).build());
    assertThat(directory.listReadable("", null, 20)).isEmpty();
    assertThat(directory.listReadable(null, null, 20)).isEmpty();
  }
}
