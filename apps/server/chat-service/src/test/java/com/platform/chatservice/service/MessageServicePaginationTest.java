package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Integration test for cursor-based pagination in {@link MessageService}.
 *
 * <p>Uses Testcontainers to spin up a real MongoDB 7 instance so that the actual Spring Data query
 * methods and compound indexes are exercised — bugs in query derivation or index definitions are
 * caught here but would be invisible in the mock-based unit tests in {@link MessageServiceTest}.
 *
 * <p>Annotated with {@code @DataMongoTest} (MongoDB slice) so the full application context
 * (RabbitMQ, Redis, JWT secret, Firebase) is NOT started. Non-MongoDB collaborators are supplied as
 * hand-wired mocks.
 */
@DataMongoTest
@Testcontainers
@Import({MessageMapper.class})
class MessageServicePaginationTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProperties(DynamicPropertyRegistry registry) {
    // Use host+mapped-port to build a URI that resolves from the host machine.
    // getReplicaSetUrl() returns the container-internal hostname which is not
    // accessible from the host JVM — it would cause MongoSocketReadException.
    registry.add(
        "spring.data.mongodb.uri",
        () -> "mongodb://" + mongo.getHost() + ":" + mongo.getMappedPort(27017) + "/platform_test");
  }

  @Autowired private MessageRepository messageRepository;

  @Autowired private ConversationRepository conversationRepository;

  @Autowired private MongoTemplate mongoTemplate;

  @Autowired private MessageMapper messageMapper;

  private MessageService messageService;

  private static final String USER_ID = "user-it-001";
  private static final String OTHER_USER_ID = "user-it-002";
  private static final String CONV_ID = "conv-it-001";
  private static final String OTHER_CONV_ID = "conv-it-002";

  @BeforeEach
  void setUp() {
    messageRepository.deleteAll();
    conversationRepository.deleteAll();

    // Wire MessageService with real MongoDB repos + mocked non-Mongo deps
    SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);
    // A real cache wrapper over the real repo; its @CacheEvict is a no-op outside a Spring proxy,
    // which is fine here — these tests exercise the Mongo query/persistence paths, not caching.
    ConversationCacheService conversationCacheService =
        new ConversationCacheService(conversationRepository);
    AiMessageService aiMessageService =
        new AiMessageService(
            messageRepository,
            conversationRepository,
            messagingTemplate,
            messageMapper,
            mongoTemplate,
            conversationCacheService);
    MessageServiceHelper helper = mock(MessageServiceHelper.class);

    messageService =
        new MessageService(
            messageRepository,
            conversationRepository,
            mongoTemplate,
            helper,
            messageMapper,
            aiMessageService,
            conversationCacheService);

    // Insert the primary test conversation with USER_ID as participant
    conversationRepository.save(
        Conversation.builder()
            .id(CONV_ID)
            .participants(new ArrayList<>(List.of(USER_ID, OTHER_USER_ID)))
            .type(Conversation.TYPE_DIRECT)
            .build());

    // Insert 5 messages with strictly increasing createdAt timestamps.
    // We set createdAt directly via setter before saving so we control the
    // exact values regardless of @CreatedDate auditing order.
    Instant base = Instant.parse("2026-01-01T10:00:00Z");
    for (int i = 0; i < 5; i++) {
      Message msg =
          Message.builder()
              .id("msg-it-" + i)
              .conversationId(CONV_ID)
              .senderId(USER_ID)
              .content("Message " + i)
              .type("text")
              .readBy(new ArrayList<>(List.of(USER_ID)))
              .build();
      msg.setCreatedAt(base.plusSeconds(i));
      messageRepository.save(msg);
    }
  }

  /**
   * TEST 1 — First page (no cursor): {@code getMessages(convId, null, 2)} must return exactly 2
   * messages, NEWEST first (msg-it-4, msg-it-3), and {@code hasNext == true} because there are 3
   * more older messages.
   */
  @Test
  void firstPage_returnsNewestTwoMessages_andHasMore() {
    PageResponse<MessageResponse> page = messageService.getMessages(USER_ID, CONV_ID, null, 2);

    assertThat(page.content()).hasSize(2);
    // Newest first: msg-it-4 (createdAt+4s), msg-it-3 (createdAt+3s)
    assertThat(page.content().get(0).id()).isEqualTo("msg-it-4");
    assertThat(page.content().get(1).id()).isEqualTo("msg-it-3");
    assertThat(page.hasNext()).isTrue();
  }

  /**
   * TEST 2 — Cursor page: Using the last message from page 1 (msg-it-3) as cursor, the next page
   * must return msg-it-2 and msg-it-1 (strictly older, newest-first within the page), with NO
   * overlap with the first page.
   */
  @Test
  void cursorPage_returnsNextTwoOlderMessages_noOverlapWithFirstPage() {
    // Page 1 cursor = id of the last (oldest) item on the first page = msg-it-3
    String cursor = "msg-it-3";

    PageResponse<MessageResponse> page2 = messageService.getMessages(USER_ID, CONV_ID, cursor, 2);

    assertThat(page2.content()).hasSize(2);
    // Must be the two messages older than msg-it-3: msg-it-2 then msg-it-1
    assertThat(page2.content().get(0).id()).isEqualTo("msg-it-2");
    assertThat(page2.content().get(1).id()).isEqualTo("msg-it-1");
    // No overlap: none of page2 ids appear on page1 (msg-it-4, msg-it-3)
    assertThat(page2.content())
        .extracting(MessageResponse::id)
        .doesNotContain("msg-it-4", "msg-it-3");
  }

  /**
   * TEST 3 — Last page / hasMore == false: After consuming page1 (msg-4, msg-3) and page2 (msg-2,
   * msg-1), the final page using cursor = msg-it-1 must return only msg-it-0 and {@code hasNext ==
   * false} because there are no more older messages.
   */
  @Test
  void lastPage_hasMoreIsFalse_andRemainingCountIsCorrect() {
    // Cursor = last item from page 2
    String cursor = "msg-it-1";

    PageResponse<MessageResponse> lastPage =
        messageService.getMessages(USER_ID, CONV_ID, cursor, 2);

    assertThat(lastPage.content()).hasSize(1);
    assertThat(lastPage.content().get(0).id()).isEqualTo("msg-it-0");
    assertThat(lastPage.hasNext()).isFalse();
  }

  /**
   * TEST 4 — Conversation isolation: Messages for a different conversationId must NOT appear in
   * paginated results for the primary conversation.
   */
  @Test
  void conversationIsolation_differentConvMessages_notReturned() {
    // Insert a separate conversation and a message belonging to it
    conversationRepository.save(
        Conversation.builder()
            .id(OTHER_CONV_ID)
            .participants(new ArrayList<>(List.of(USER_ID, OTHER_USER_ID)))
            .type(Conversation.TYPE_DIRECT)
            .build());
    Message otherMsg =
        Message.builder()
            .id("msg-other-0")
            .conversationId(OTHER_CONV_ID)
            .senderId(USER_ID)
            .content("Other conv message")
            .type("text")
            .readBy(new ArrayList<>(List.of(USER_ID)))
            .build();
    otherMsg.setCreatedAt(Instant.parse("2026-01-01T11:00:00Z"));
    messageRepository.save(otherMsg);

    // Fetch messages for the PRIMARY conversation — must return exactly 5, none from OTHER_CONV_ID
    PageResponse<MessageResponse> page = messageService.getMessages(USER_ID, CONV_ID, null, 10);

    assertThat(page.content()).hasSize(5);
    assertThat(page.content()).extracting(MessageResponse::conversationId).containsOnly(CONV_ID);
    assertThat(page.content()).extracting(MessageResponse::id).doesNotContain("msg-other-0");
  }

  /**
   * TEST 5 — Same-millisecond tiebreaker: three messages sharing the exact same {@code createdAt}
   * must NOT be skipped by cursor pagination. With a createdAt-only cursor the older same-instant
   * rows were silently dropped; the compound {@code (createdAt, _id)} cursor pages through all of
   * them with no gap and no overlap.
   */
  @Test
  void sameMillisecondMessages_areNotSkippedByCursor() {
    messageRepository.deleteAll();
    // Distinct ObjectId hex ids (production-shaped) sharing one timestamp; _id order is a=b<c.
    Instant sameInstant = Instant.parse("2026-02-02T12:00:00Z");
    String idA = "507f1f77bcf86cd799430001";
    String idB = "507f1f77bcf86cd799430002";
    String idC = "507f1f77bcf86cd799430003";
    for (String id : List.of(idA, idB, idC)) {
      Message m =
          Message.builder()
              .id(id)
              .conversationId(CONV_ID)
              .senderId(USER_ID)
              .content("same-instant " + id)
              .type("text")
              .readBy(new ArrayList<>(List.of(USER_ID)))
              .build();
      m.setCreatedAt(sameInstant);
      messageRepository.save(m);
    }

    // Page 1 (size 2): newest-first by _id → idC, idB.
    PageResponse<MessageResponse> page1 = messageService.getMessages(USER_ID, CONV_ID, null, 2);
    assertThat(page1.content()).extracting(MessageResponse::id).containsExactly(idC, idB);
    assertThat(page1.hasNext()).isTrue();

    // Page 2 using idB (same createdAt) as cursor must return the remaining idA — not skip it.
    PageResponse<MessageResponse> page2 = messageService.getMessages(USER_ID, CONV_ID, idB, 2);
    assertThat(page2.content()).extracting(MessageResponse::id).containsExactly(idA);
    assertThat(page2.hasNext()).isFalse();
  }
}
