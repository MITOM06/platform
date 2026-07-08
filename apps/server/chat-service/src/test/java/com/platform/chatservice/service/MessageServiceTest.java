package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.AiHistoryEntry;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.exception.MessageNotFoundException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

  @Mock private MessageRepository messageRepository;
  @Mock private ConversationRepository conversationRepository;
  @Mock private MongoTemplate mongoTemplate;
  @Mock private org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;
  @Mock private MessageServiceHelper messageServiceHelper;
  @Mock private ConversationCacheService conversationCacheService;

  // Collaborators extracted from MessageService are wired with real instances so
  // these tests still exercise the same behavior through the same mocked deps.
  private MessageService messageService;

  private static final String SENDER_ID = "user-001";
  private static final String OTHER_ID = "user-002";
  private static final String CONV_ID = "conv-001";
  private static final String MSG_ID = "msg-001";

  private Conversation conversation;
  private Message savedMessage;

  @BeforeEach
  void setUp() {
    MessageMapper messageMapper = new MessageMapper();
    AiMessageService aiMessageService =
        new AiMessageService(
            messageRepository,
            conversationRepository,
            messagingTemplate,
            messageMapper,
            mongoTemplate,
            conversationCacheService);
    messageService =
        new MessageService(
            messageRepository,
            conversationRepository,
            mongoTemplate,
            messageServiceHelper,
            messageMapper,
            aiMessageService,
            conversationCacheService);

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
  void sendMessage_ShouldSaveMessageAndUpdateConversation() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);

    MessageResponse response =
        messageService.sendMessage(SENDER_ID, new SendMessageRequest(CONV_ID, "Hello", "text"));

    assertThat(response.id()).isEqualTo(MSG_ID);
    assertThat(response.content()).isEqualTo("Hello");
    assertThat(response.senderId()).isEqualTo(SENDER_ID);
    verify(messageRepository).save(any(Message.class));
    // Conversation bump is now a targeted atomic $set (not a whole-document save) + cache evict.
    verify(mongoTemplate).updateFirst(any(Query.class), any(Update.class), eq(Conversation.class));
    verify(conversationCacheService).evict(CONV_ID);
  }

  @Test
  void sendMessage_ByRecipientOnPending_ShouldAcceptConversation() {
    Conversation pending =
        Conversation.builder()
            .id(CONV_ID)
            .participants(List.of(SENDER_ID, OTHER_ID))
            .createdBy(OTHER_ID) // OTHER started the request; SENDER is the recipient replying
            .status(Conversation.STATUS_PENDING)
            .build();
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(pending));
    when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);

    messageService.sendMessage(SENDER_ID, new SendMessageRequest(CONV_ID, "Hello", "text"));

    // The recipient's reply flips status→accepted via the atomic $set update.
    verify(mongoTemplate)
        .updateFirst(
            any(Query.class),
            argThat((Update u) -> Conversation.STATUS_ACCEPTED.equals(setValue(u, "status"))),
            eq(Conversation.class));
  }

  @Test
  void sendMessage_ByInitiatorOnPending_ShouldStayPending() {
    Conversation pending =
        Conversation.builder()
            .id(CONV_ID)
            .participants(List.of(SENDER_ID, OTHER_ID))
            .createdBy(SENDER_ID) // SENDER is the initiator; their message must not auto-accept
            .status(Conversation.STATUS_PENDING)
            .build();
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(pending));
    when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);

    messageService.sendMessage(SENDER_ID, new SendMessageRequest(CONV_ID, "Hi", "text"));

    // The initiator's own message must NOT set status (stays pending): the $set has no status key.
    verify(mongoTemplate)
        .updateFirst(
            any(Query.class),
            argThat((Update u) -> setValue(u, "status") == null),
            eq(Conversation.class));
  }

  @Test
  void sendMessage_ShouldDefaultTypeToText_WhenTypeIsNull() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);

    messageService.sendMessage(SENDER_ID, new SendMessageRequest(CONV_ID, "Hello", null));

    verify(messageRepository).save(argThat(m -> "text".equals(m.getType())));
  }

  @Test
  void sendMessage_WhenConversationNotFound_ShouldThrow() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                messageService.sendMessage(
                    SENDER_ID, new SendMessageRequest(CONV_ID, "Hi", "text")))
        .isInstanceOf(ConversationNotFoundException.class);

    verifyNoInteractions(messageRepository);
  }

  @Test
  void sendMessage_WhenUserNotParticipant_ShouldThrow() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

    assertThatThrownBy(
            () ->
                messageService.sendMessage(
                    "intruder-999", new SendMessageRequest(CONV_ID, "Hi", "text")))
        .isInstanceOf(ConversationNotFoundException.class);

    verifyNoInteractions(messageRepository);
  }

  @Test
  void sendMessage_WhenSenderBlockedByRecipient_ShouldThrow() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(messageServiceHelper.isBlockedBetween(SENDER_ID, OTHER_ID)).thenReturn(true);

    assertThatThrownBy(
            () ->
                messageService.sendMessage(
                    SENDER_ID, new SendMessageRequest(CONV_ID, "Hi", "text")))
        .isInstanceOf(ForbiddenException.class);

    verify(messageRepository, never()).save(any(Message.class));
  }

  @Test
  void sendMessage_WhenSenderBlockedRecipient_ShouldThrow() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(messageServiceHelper.isBlockedBetween(SENDER_ID, OTHER_ID)).thenReturn(true);

    assertThatThrownBy(
            () ->
                messageService.sendMessage(
                    SENDER_ID, new SendMessageRequest(CONV_ID, "Hi", "text")))
        .isInstanceOf(ForbiddenException.class);

    verify(messageRepository, never()).save(any(Message.class));
  }

  @Test
  void getMessages_ShouldReturnPagedResponse() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    // Visibility filtering + the compound cursor are pushed into a single MongoTemplate query.
    when(mongoTemplate.find(any(Query.class), eq(Message.class))).thenReturn(List.of(savedMessage));

    // No cursor → most recent page.
    PageResponse<MessageResponse> result = messageService.getMessages(SENDER_ID, CONV_ID, null, 20);

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
        messageService.getMessages(SENDER_ID, CONV_ID, MSG_ID, 20);

    assertThat(result.content()).isEmpty();
    // Cursor message is resolved to build the compound (createdAt, _id) tiebreaker query.
    verify(messageRepository).findById(MSG_ID);
    verify(mongoTemplate).find(any(Query.class), eq(Message.class));
  }

  @Test
  void getMessages_WhenUserNotParticipant_ShouldThrow() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

    assertThatThrownBy(() -> messageService.getMessages("outsider", CONV_ID, null, 20))
        .isInstanceOf(ConversationNotFoundException.class);
  }

  @Test
  void editMessage_BySender_ShouldUpdateContentAndStampEditedAt() {
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));
    when(messageRepository.save(any(Message.class))).thenAnswer(inv -> inv.getArgument(0));

    MessageResponse response = messageService.editMessage(SENDER_ID, MSG_ID, "Edited text");

    assertThat(response.content()).isEqualTo("Edited text");
    assertThat(response.editedAt()).isNotNull();
    verify(messageRepository)
        .save(argThat(m -> "Edited text".equals(m.getContent()) && m.getEditedAt() != null));
  }

  @Test
  void editMessage_ByNonSender_ShouldThrow() {
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));

    assertThatThrownBy(() -> messageService.editMessage(OTHER_ID, MSG_ID, "Hacked"))
        .isInstanceOf(ForbiddenException.class);

    verify(messageRepository, never()).save(any(Message.class));
  }

  @Test
  void editMessage_WhenRecalled_ShouldThrow() {
    savedMessage.setRecalled(true);
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));

    assertThatThrownBy(() -> messageService.editMessage(SENDER_ID, MSG_ID, "Edited"))
        .isInstanceOf(IllegalArgumentException.class);

    verify(messageRepository, never()).save(any(Message.class));
  }

  @Test
  void editMessage_WhenContentBlank_ShouldThrow() {
    assertThatThrownBy(() -> messageService.editMessage(SENDER_ID, MSG_ID, "   "))
        .isInstanceOf(IllegalArgumentException.class);

    verify(messageRepository, never()).findById(anyString());
  }

  @Test
  void searchMessages_ShouldReturnMatchingMessages() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(mongoTemplate.find(any(Query.class), eq(Message.class))).thenReturn(List.of(savedMessage));

    List<MessageResponse> results = messageService.searchMessages(SENDER_ID, CONV_ID, "Hello");

    assertThat(results).hasSize(1);
    assertThat(results.get(0).id()).isEqualTo(MSG_ID);
    verify(mongoTemplate).find(any(Query.class), eq(Message.class));
  }

  @Test
  void searchMessages_WhenBlankQuery_ShouldReturnEmptyWithoutQuerying() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

    assertThat(messageService.searchMessages(SENDER_ID, CONV_ID, "   ")).isEmpty();

    verify(mongoTemplate, never()).find(any(Query.class), eq(Message.class));
  }

  @Test
  void searchMessages_WhenUserNotParticipant_ShouldThrow() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

    assertThatThrownBy(() -> messageService.searchMessages("outsider", CONV_ID, "Hello"))
        .isInstanceOf(ConversationNotFoundException.class);
  }

  @Test
  void sendMessage_WithMention_ShouldResolveMentionedUserIds() {
    // Valid ObjectId hex so the users-collection lookup path runs.
    String mentionerId = "507f1f77bcf86cd799439011";
    String mentioneeId = "507f1f77bcf86cd799439012";
    Conversation group =
        Conversation.builder().id(CONV_ID).participants(List.of(mentionerId, mentioneeId)).build();
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(group));
    when(messageRepository.save(any(Message.class)))
        .thenAnswer(
            inv -> {
              Message m = inv.getArgument(0);
              m.setId(MSG_ID);
              m.setCreatedAt(Instant.now());
              return m;
            });
    when(messageServiceHelper.parseMentions(anyString(), anyList(), anyString()))
        .thenReturn(List.of(mentioneeId));

    MessageResponse response =
        messageService.sendMessage(
            mentionerId, new SendMessageRequest(CONV_ID, "Hey @Alice check this", "text"));

    assertThat(response.mentions()).containsExactly(mentioneeId);
  }

  @Test
  void markAsRead_WhenParticipant_ShouldUpdateReadByAndReturnConversationId() {
    // requireParticipantMessage enforces membership and yields the message (with its convId).
    when(messageServiceHelper.requireParticipantMessage(SENDER_ID, MSG_ID))
        .thenReturn(savedMessage);

    String conversationId = messageService.markAsRead(SENDER_ID, MSG_ID);

    assertThat(conversationId).isEqualTo(CONV_ID);
    verify(mongoTemplate).updateFirst(any(Query.class), any(Update.class), eq(Message.class));
  }

  @Test
  void markAsRead_WhenMessageNotFound_ShouldThrow() {
    when(messageServiceHelper.requireParticipantMessage(SENDER_ID, "non-existent"))
        .thenThrow(new MessageNotFoundException("non-existent"));

    assertThatThrownBy(() -> messageService.markAsRead(SENDER_ID, "non-existent"))
        .isInstanceOf(MessageNotFoundException.class);

    verify(mongoTemplate, never())
        .updateFirst(any(Query.class), any(Update.class), eq(Message.class));
  }

  // -----------------------------------------------------------------------
  // Task 53 — Pin & Forward
  // -----------------------------------------------------------------------

  @Test
  void pinMessage_WhenParticipant_ShouldAddToPinnedList() {
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(conversationRepository.save(any(Conversation.class)))
        .thenAnswer(inv -> inv.getArgument(0));
    // createSystemMessage persists the "X pinned a message" notice.
    when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);

    var result = messageService.pinMessage(SENDER_ID, MSG_ID);

    assertThat(result.conversationId()).isEqualTo(CONV_ID);
    assertThat(result.pinnedMessages()).containsExactly(MSG_ID);
  }

  @Test
  void pinMessage_WhenNotParticipant_ShouldThrow() {
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

    assertThatThrownBy(() -> messageService.pinMessage("outsider", MSG_ID))
        .isInstanceOf(ForbiddenException.class);
  }

  @Test
  void pinMessage_WhenRecalled_ShouldThrow() {
    Message recalled = savedMessage;
    recalled.setRecalled(true);
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(recalled));
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

    assertThatThrownBy(() -> messageService.pinMessage(SENDER_ID, MSG_ID))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("recalled");
  }

  @Test
  void unpinMessage_ShouldRemoveFromPinnedList() {
    conversation.setPinnedMessages(new java.util.ArrayList<>(List.of(MSG_ID)));
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(conversationRepository.save(any(Conversation.class)))
        .thenAnswer(inv -> inv.getArgument(0));
    // createSystemMessage persists the "X unpinned a message" notice.
    when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);

    var result = messageService.unpinMessage(SENDER_ID, MSG_ID);

    assertThat(result.pinnedMessages()).doesNotContain(MSG_ID);
  }

  @Test
  void forwardMessage_WhenParticipant_ShouldCreateNewMessage() {
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    String targetConvId = "conv-002";
    Conversation targetConv =
        Conversation.builder().id(targetConvId).participants(List.of(SENDER_ID, OTHER_ID)).build();
    when(conversationRepository.findById(targetConvId)).thenReturn(Optional.of(targetConv));
    when(messageRepository.save(any(Message.class)))
        .thenAnswer(
            inv -> {
              Message m = inv.getArgument(0);
              m.setId("forwarded-msg");
              m.setCreatedAt(Instant.now());
              return m;
            });

    MessageResponse result = messageService.forwardMessage(SENDER_ID, MSG_ID, targetConvId);

    assertThat(result.conversationId()).isEqualTo(targetConvId);
    assertThat(result.content()).isEqualTo(savedMessage.getContent());
  }

  @Test
  void forwardMessage_WhenRecalled_ShouldThrow() {
    savedMessage.setRecalled(true);
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));

    assertThatThrownBy(() -> messageService.forwardMessage(SENDER_ID, MSG_ID, "conv-002"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("recalled");
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

    List<MessageResponse> results = messageService.getMessagesSince(SENDER_ID, CONV_ID, after);

    assertThat(results).hasSize(1);
    assertThat(results.get(0).id()).isEqualTo("msg-new");
  }

  @Test
  void getMessagesSince_WhenNotParticipant_ShouldThrow() {
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

    assertThatThrownBy(
            () -> messageService.getMessagesSince("intruder-999", CONV_ID, Instant.now()))
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

    List<AiHistoryEntry> history = messageService.getAiHistory(SENDER_ID, CONV_ID);

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

    List<AiHistoryEntry> history = messageService.getAiHistory(SENDER_ID, CONV_ID);

    assertThat(history).hasSize(2);
    // chronological: single URL first
    assertThat(history.get(0).type()).isEqualTo("image");
    assertThat(history.get(0).imageUrls()).containsExactly("/api/uploads/665fa1");
    assertThat(history.get(0).content()).isEmpty();
    // JSON-array second
    assertThat(history.get(1).type()).isEqualTo("image");
    assertThat(history.get(1).imageUrls()).containsExactly("/api/uploads/a", "/api/uploads/b");
  }

  // -------------------------------------------------------------------------
  // Sprint AI-1 — saveAiMessage
  // -------------------------------------------------------------------------

  @Test
  void saveAiMessage_ShouldSaveWithAiBotSenderAndBroadcast() {
    String content = "Here is the AI reply";
    Message aiMessage =
        Message.builder()
            .id("ai-msg-1")
            .conversationId(CONV_ID)
            .senderId(com.platform.chatservice.service.AiConstants.AI_BOT_USER_ID)
            .content(content)
            .type("ai")
            .readBy(new java.util.ArrayList<>())
            .createdAt(Instant.now())
            .build();
    when(messageRepository.save(any(Message.class))).thenReturn(aiMessage);

    MessageResponse response = messageService.saveAiMessage(CONV_ID, content, null);

    assertThat(response.senderId())
        .isEqualTo(com.platform.chatservice.service.AiConstants.AI_BOT_USER_ID);
    assertThat(response.type()).isEqualTo("ai");
    assertThat(response.content()).isEqualTo(content);
    verify(messageRepository)
        .save(
            argThat(
                m ->
                    com.platform.chatservice.service.AiConstants.AI_BOT_USER_ID.equals(
                            m.getSenderId())
                        && "ai".equals(m.getType())
                        && content.equals(m.getContent())));
    verify(messagingTemplate)
        .convertAndSend(eq("/topic/conversation/" + CONV_ID), (Object) eq(response));
  }

  /** Read a field out of an Update's {@code $set} document (null if the key was not set). */
  private static Object setValue(Update update, String key) {
    Document updateDoc = update.getUpdateObject();
    Document set = updateDoc.get("$set", Document.class);
    return set == null ? null : set.get(key);
  }
}
