package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.MessageResponse;
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

/**
 * Unit tests for the send/read-receipt/AI-persist paths of {@link MessageService}. Split out of the
 * original {@code MessageServiceTest} by feature area (see also {@link MessagePinTest} and {@link
 * MessageQueryServiceTest}).
 */
@ExtendWith(MockitoExtension.class)
class MessageSendTest {

  @Mock private MessageRepository messageRepository;
  @Mock private ConversationRepository conversationRepository;
  @Mock private MongoTemplate mongoTemplate;
  @Mock private org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;
  @Mock private MessageServiceHelper messageServiceHelper;
  @Mock private ConversationCacheService conversationCacheService;

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
