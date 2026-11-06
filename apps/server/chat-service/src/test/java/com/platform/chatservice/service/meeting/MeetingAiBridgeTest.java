package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.AiHistoryEntry;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.model.MeetingMessage;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.AiConstants;
import com.platform.chatservice.service.AiRedisPublisher;
import com.platform.chatservice.service.MessageQueryService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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
class MeetingAiBridgeTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  @Autowired private MongoTemplate template;
  private MeetingEvents events;
  private AiRedisPublisher publisher;
  private MessageQueryService queries;
  private MeetingPeople people;
  private MeetingAiBridge bridge;
  private final UserPrincipal an =
      new UserPrincipal("a", "Manager", List.of("P1"), List.of("d1", "d2"));

  @BeforeEach
  void setUp() {
    template.dropCollection(MeetingMessage.class);
    events = mock(MeetingEvents.class);
    publisher = mock(AiRedisPublisher.class);
    queries = mock(MessageQueryService.class);
    people = mock(MeetingPeople.class);
    when(queries.resolveDisplayName("a")).thenReturn("An");
    when(people.profiles(anyCollection()))
        .thenReturn(
            Map.of(
                "a", new PersonDto("a", "An", null),
                "b", new PersonDto("b", "Binh", null)));
    bridge = new MeetingAiBridge(template, events, publisher, queries, people);
  }

  private void line(int sec, String sender, String text) {
    template.insert(
        MeetingMessage.builder()
            .meetingId("m1")
            .senderId(sender)
            .content(text)
            .createdAt(Instant.parse("2026-11-06T01:00:00Z").plusSeconds(sec))
            .build());
  }

  @SuppressWarnings("unchecked")
  private List<AiHistoryEntry> publishedHistory() {
    ArgumentCaptor<List<AiHistoryEntry>> h = ArgumentCaptor.forClass(List.class);
    verify(publisher)
        .publishMeetingAiRequest(
            eq("m1"),
            eq("a"),
            eq("An"),
            anyString(),
            h.capture(),
            eq("Manager"),
            eq(List.of("P1")),
            eq(List.of("d1", "d2")));
    return h.getValue();
  }

  @Test
  void mentionDetectionMatchesAiAndPonaiOnly() {
    assertThat(MeetingAiBridge.mentionsAi("hey @AI sum up")).isTrue();
    assertThat(MeetingAiBridge.mentionsAi("@PonAi?")).isTrue();
    assertThat(MeetingAiBridge.mentionsAi("@AIR no")).isFalse();
    assertThat(MeetingAiBridge.mentionsAi("plain")).isFalse();
  }

  @Test
  void runPublishesStrippedContentWithCallerClaimsAndSaysThinking() {
    bridge.run(an, "m1", "@AI what did we decide?");

    ArgumentCaptor<String> content = ArgumentCaptor.forClass(String.class);
    verify(publisher)
        .publishMeetingAiRequest(
            eq("m1"),
            eq("a"),
            eq("An"),
            content.capture(),
            anyList(),
            eq("Manager"),
            eq(List.of("P1")),
            eq(List.of("d1", "d2")));
    assertThat(content.getValue()).isEqualTo("what did we decide?");
    verify(events).ai("m1", "thinking", "a", null);
  }

  @Test
  void aBareMentionIsNotAQuestion() {
    assertThat(MeetingAiBridge.mentionsAi("@AI")).isFalse();
    assertThat(MeetingAiBridge.mentionsAi("  @ponai  @AI ")).isFalse();
    assertThat(MeetingAiBridge.mentionsAi("@AI ?")).isTrue();
  }

  @Test
  void aMentionAloneSendsNoAiRequestAndNoThinking() {
    bridge.run(an, "m1", "@AI");
    bridge.run(an, "m1", "  @PonAI ");

    verify(publisher, never())
        .publishMeetingAiRequest(
            anyString(), anyString(), anyString(), anyString(), anyList(), any(), any(), any());
    verify(events, never()).ai(anyString(), anyString(), anyString(), any());
  }

  @Test
  void historyIsTheTwentyNewestAscendingWithBotAsAssistantAndWithoutTheTrigger() {
    for (int i = 0; i < 25; i++) {
      line(i, i % 2 == 0 ? "a" : "b", "line " + i);
    }
    line(30, AiConstants.AI_BOT_USER_ID, "bot answer");
    line(31, "a", "@AI now?");

    bridge.run(an, "m1", "@AI now?");

    List<AiHistoryEntry> history = publishedHistory();
    assertThat(history).hasSize(20);
    assertThat(history.get(19).content()).isEqualTo("bot answer");
    assertThat(history.get(19).role()).isEqualTo("assistant");
    assertThat(history.get(18).content()).isEqualTo("line 24");
    assertThat(history.get(18).role()).isEqualTo("user");
    assertThat(history.get(18).senderName()).isEqualTo("An");
    assertThat(history.get(17).senderName()).isEqualTo("Binh");
    assertThat(history.get(0).content()).isEqualTo("line 6");
    assertThat(history).noneMatch(e -> e.content().contains("now?"));
  }

  @Test
  void aPublishFailureTellsTheRoomAiUnavailable() {
    doThrow(new IllegalStateException("rabbit down"))
        .when(publisher)
        .publishMeetingAiRequest(
            anyString(), anyString(), anyString(), anyString(), anyList(), any(), any(), any());

    bridge.run(an, "m1", "@AI hi");

    verify(events).ai("m1", "error", "a", "AI_UNAVAILABLE");
  }

  @Test
  void askRunsAsynchronously() {
    bridge.ask(an, "m1", "@AI hi");

    verify(publisher, timeout(5000))
        .publishMeetingAiRequest(
            eq("m1"), eq("a"), eq("An"), eq("hi"), anyList(), any(), any(), any());
    verify(events, never()).ai(anyString(), eq("error"), anyString(), isNull());
  }
}
