package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.AiHistoryEntry;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

/**
 * Unit tests for the read/query side of the message domain ({@link MessageQueryService}): cursor
 * pagination, in-conversation search, offline catch-up and AI-history assembly. Split out of the
 * original {@code MessageServiceTest} when these methods moved into their own service.
 */
@ExtendWith(MockitoExtension.class)
class MessageQueryServiceTest {

  @Mock private MessageRepository messageRepository;
  @Mock private ConversationRepository conversationRepository;
  @Mock private MongoTemplate mongoTemplate;
  @Mock private MessageServiceHelper messageServiceHelper;

  private MessageQueryService messageQueryService;

  private static final String SENDER_ID = "user-001";
  private static final String OTHER_ID = "user-002";
  private static final String CONV_ID = "conv-001";
  private static final String MSG_ID = "msg-001";

  private Conversation conversation;
  private Message savedMessage;

  @BeforeEach
  void setUp() {
    MessageMapper messageMapper = new MessageMapper();
    messageQueryService =
        new MessageQueryService(
            messageRepository,
            conversationRepository,
            mongoTemplate,
            messageServiceHelper,
            messageMapper);

    conversation =
        Conversation.builder().id(CONV_ID).participants(List.of(SENDER_ID, OTHER_ID)).build();
    savedMessage =
        Message.builder()
            .id(MSG_ID)
            .conversationId(CONV_ID)
            .senderId(SENDER_ID)
            .content("Hello")
            .type("text")
            .readBy(List.of(SENDER_ID))
            .createdAt(Instant.now())
            .build();
  }

  @Test
  void getMessages_ShouldReturnPagedResponse() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    // Visibility filtering + the compound cursor are pushed into a single MongoTemplate query.
    when(mongoTemplate.find(any(Query.class), eq(Message.class))).thenReturn(List.of(savedMessage));

    // No cursor → most recent page.
    PageResponse<MessageResponse> result =
        messageQueryService.getMessages(SENDER_ID, CONV_ID, null, 20);

    assertThat(result.content()).hasSize(1);
    assertThat(result.content().get(0).id()).isEqualTo(MSG_ID);
    assertThat(result.page()).isZero();
    // Only one row (< size) → no older history.
    assertThat(result.hasNext()).isFalse();
  }

  @Test
  void getMessages_WithCursor_ShouldQueryOlderMessages() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));
    when(mongoTemplate.find(any(Query.class), eq(Message.class))).thenReturn(List.of());

    PageResponse<MessageResponse> result =
        messageQueryService.getMessages(SENDER_ID, CONV_ID, MSG_ID, 20);

    assertThat(result.content()).isEmpty();
    // Cursor message is resolved to build the compound (createdAt, _id) tiebreaker query.
    verify(messageRepository).findById(MSG_ID);
    verify(mongoTemplate).find(any(Query.class), eq(Message.class));
  }

  @Test
  void getMessages_WhenUserNotParticipant_ShouldThrow() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

    assertThatThrownBy(() -> messageQueryService.getMessages("outsider", CONV_ID, null, 20))
        .isInstanceOf(ConversationNotFoundException.class);
  }

  @Test
  void searchMessages_ShouldReturnMatchingMessages() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(mongoTemplate.find(any(Query.class), eq(Message.class))).thenReturn(List.of(savedMessage));

    List<MessageResponse> results = messageQueryService.searchMessages(SENDER_ID, CONV_ID, "Hello");

    assertThat(results).hasSize(1);
    assertThat(results.get(0).id()).isEqualTo(MSG_ID);
    verify(mongoTemplate).find(any(Query.class), eq(Message.class));
  }

  @Test
  void searchMessages_WhenBlankQuery_ShouldReturnEmptyWithoutQuerying() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

    assertThat(messageQueryService.searchMessages(SENDER_ID, CONV_ID, "   ")).isEmpty();

    verify(mongoTemplate, never()).find(any(Query.class), eq(Message.class));
  }

  @Test
  void searchMessages_WhenUserNotParticipant_ShouldThrow() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

    assertThatThrownBy(() -> messageQueryService.searchMessages("outsider", CONV_ID, "Hello"))
        .isInstanceOf(ConversationNotFoundException.class);
  }

  // -------------------------------------------------------------------------
  // Task 55 — getMessagesSince (offline catch-up)
  // -------------------------------------------------------------------------

  @Test
  void getMessagesSince_ShouldReturnNewerMessages() {
    Instant after = Instant.now().minusSeconds(60);
    Message newer =
        Message.builder()
            .id("msg-new")
            .conversationId(CONV_ID)
            .senderId(OTHER_ID)
            .content("New message")
            .type("text")
            .readBy(List.of(OTHER_ID))
            .createdAt(Instant.now())
            .build();
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(messageRepository.findByConversationIdAndCreatedAtGreaterThanOrderByCreatedAtAsc(
            eq(CONV_ID), eq(after), any()))
        .thenReturn(List.of(newer));

    List<MessageResponse> results = messageQueryService.getMessagesSince(SENDER_ID, CONV_ID, after);

    assertThat(results).hasSize(1);
    assertThat(results.get(0).id()).isEqualTo("msg-new");
  }

  @Test
  void getMessagesSince_WhenNotParticipant_ShouldThrow() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

    assertThatThrownBy(
            () -> messageQueryService.getMessagesSince("intruder-999", CONV_ID, Instant.now()))
        .isInstanceOf(ConversationNotFoundException.class);

    verifyNoInteractions(messageRepository);
  }

  // -------------------------------------------------------------------------
  // Sprint AI-2.1 — getAiHistory filtering
  // -------------------------------------------------------------------------

  @Test
  void getAiHistory_ExcludesNonTextTypes_AndMapsBotToAssistant() {
    // Arrange: mix of types — only text and ai should survive
    Message textMsg =
        Message.builder()
            .id("m1")
            .conversationId(CONV_ID)
            .senderId(SENDER_ID)
            .content("Hello")
            .type("text")
            .readBy(new java.util.ArrayList<>())
            .createdAt(Instant.now().minusSeconds(30))
            .build();
    Message voiceMsg =
        Message.builder()
            .id("m2")
            .conversationId(CONV_ID)
            .senderId(SENDER_ID)
            .content("voice-url")
            .type("voice")
            .readBy(new java.util.ArrayList<>())
            .createdAt(Instant.now().minusSeconds(20))
            .build();
    Message botMsg =
        Message.builder()
            .id("m3")
            .conversationId(CONV_ID)
            .senderId(AiConstants.AI_BOT_USER_ID)
            .content("AI reply")
            .type("ai")
            .readBy(new java.util.ArrayList<>())
            .createdAt(Instant.now().minusSeconds(10))
            .build();
    Message stickerMsg =
        Message.builder()
            .id("m4")
            .conversationId(CONV_ID)
            .senderId(SENDER_ID)
            .content("😊")
            .type("sticker")
            .readBy(new java.util.ArrayList<>())
            .createdAt(Instant.now())
            .build();
    Message atAiMsg =
        Message.builder()
            .id("m5")
            .conversationId(CONV_ID)
            .senderId(SENDER_ID)
            .content("@AI what is Flutter?")
            .type("text")
            .readBy(new java.util.ArrayList<>())
            .createdAt(Instant.now().minusSeconds(5))
            .build();

    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(mongoTemplate.find(any(Query.class), eq(Message.class)))
        .thenReturn(List.of(atAiMsg, stickerMsg, botMsg, voiceMsg, textMsg));

    List<AiHistoryEntry> history = messageQueryService.getAiHistory(SENDER_ID, CONV_ID);

    // Should contain only text and ai messages (3), in chronological order
    assertThat(history).hasSize(3);
    assertThat(history.get(0).role()).isEqualTo("user");
    assertThat(history.get(0).content()).isEqualTo("Hello");
    assertThat(history.get(0).type()).isNull(); // text turn — no image fields
    assertThat(history.get(1).role()).isEqualTo("assistant");
    assertThat(history.get(1).content()).isEqualTo("AI reply");
    // @AI mention stripped from last text message
    assertThat(history.get(2).role()).isEqualTo("user");
    assertThat(history.get(2).content()).doesNotContain("@AI").isNotBlank();
  }

  // Sprint TASK-10 — getAiHistory image turns → type=image + imageUrls
  @Test
  void getAiHistory_ImageMessage_CarriesTypeAndImageUrls() {
    Message single =
        Message.builder()
            .id("im1")
            .conversationId(CONV_ID)
            .senderId(SENDER_ID)
            .content("/api/uploads/665fa1")
            .type("image")
            .readBy(new java.util.ArrayList<>())
            .createdAt(Instant.now().minusSeconds(20))
            .build();
    Message multi =
        Message.builder()
            .id("im2")
            .conversationId(CONV_ID)
            .senderId(SENDER_ID)
            .content("[\"/api/uploads/a\",\"/api/uploads/b\"]")
            .type("image")
            .readBy(new java.util.ArrayList<>())
            .createdAt(Instant.now().minusSeconds(10))
            .build();

    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(mongoTemplate.find(any(Query.class), eq(Message.class)))
        .thenReturn(List.of(multi, single));

    List<AiHistoryEntry> history = messageQueryService.getAiHistory(SENDER_ID, CONV_ID);

    assertThat(history).hasSize(2);
    // chronological: single URL first
    assertThat(history.get(0).type()).isEqualTo("image");
    assertThat(history.get(0).imageUrls()).containsExactly("/api/uploads/665fa1");
    assertThat(history.get(0).content()).isEmpty();
    // JSON-array second
    assertThat(history.get(1).type()).isEqualTo("image");
    assertThat(history.get(1).imageUrls()).containsExactly("/api/uploads/a", "/api/uploads/b");
  }
}
