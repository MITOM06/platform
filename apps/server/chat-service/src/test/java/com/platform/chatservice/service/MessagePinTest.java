package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.exception.ForbiddenException;
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

/**
 * Unit tests for the edit / pin / unpin / forward paths of {@link MessageService} (Task 53). Split
 * out of the original {@code MessageServiceTest} by feature area (see also {@link MessageSendTest}
 * and {@link MessageQueryServiceTest}).
 */
@ExtendWith(MockitoExtension.class)
class MessagePinTest {

  @Mock private MessageRepository messageRepository;
  @Mock private ConversationRepository conversationRepository;
  @Mock private MongoTemplate mongoTemplate;
  @Mock private ClusterMessageBroker clusterBroker;
  @Mock private MessageServiceHelper messageServiceHelper;
  @Mock private ConversationCacheService conversationCacheService;

  private MessageService messageService;
  private MessageInteractionService interactionService;

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
            clusterBroker,
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
    interactionService =
        new MessageInteractionService(
            messageRepository,
            conversationRepository,
            mongoTemplate,
            messageServiceHelper,
            messageMapper,
            messageService,
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
  void editMessage_BySender_ShouldUpdateContentAndStampEditedAt_Atomically() {
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));
    Message edited =
        savedMessage.toBuilder().content("Edited text").editedAt(Instant.now()).build();
    when(mongoTemplate.findAndModify(
            any(org.springframework.data.mongodb.core.query.Query.class),
            any(org.springframework.data.mongodb.core.query.UpdateDefinition.class),
            any(org.springframework.data.mongodb.core.FindAndModifyOptions.class),
            eq(Message.class)))
        .thenReturn(edited);

    MessageService.MessageChange change =
        messageService.editMessage(SENDER_ID, MSG_ID, "Edited text");

    assertThat(change.message().content()).isEqualTo("Edited text");
    assertThat(change.message().editedAt()).isNotNull();
    assertThat(change.previewChanged()).isFalse(); // updateFirst unstubbed → preview untouched
    verify(messageRepository, never()).save(any(Message.class));
  }

  /** Only text can be edited — e.g. a client-sent system notice must not be rewritable. */
  @Test
  void editMessage_NonText_IsRejected() {
    savedMessage.setType("system");
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));

    assertThatThrownBy(() -> messageService.editMessage(SENDER_ID, MSG_ID, "x"))
        .isInstanceOf(com.platform.chatservice.exception.BadRequestException.class)
        .extracting("code")
        .isEqualTo(com.platform.chatservice.exception.ErrorCodes.MESSAGE_TYPE_NOT_ALLOWED);
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

  // -----------------------------------------------------------------------
  // Task 53 — Pin & Forward
  // -----------------------------------------------------------------------

  @Test
  void pinMessage_WhenParticipant_ShouldPinAtomically() {
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(mongoTemplate.findAndModify(
            any(org.springframework.data.mongodb.core.query.Query.class),
            any(org.springframework.data.mongodb.core.query.UpdateDefinition.class),
            any(org.springframework.data.mongodb.core.FindAndModifyOptions.class),
            eq(Conversation.class)))
        .thenReturn(conversation.toBuilder().pinnedMessages(List.of(MSG_ID)).build());
    // createSystemMessage persists the "X pinned a message" notice.
    when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);

    var result = interactionService.pinMessage(SENDER_ID, MSG_ID);

    assertThat(result.conversationId()).isEqualTo(CONV_ID);
    assertThat(result.pinnedMessages()).containsExactly(MSG_ID);
  }

  @Test
  void pinMessage_WhenNotParticipant_ShouldThrow() {
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

    assertThatThrownBy(() -> interactionService.pinMessage("outsider", MSG_ID))
        .isInstanceOf(ForbiddenException.class);
  }

  @Test
  void pinMessage_WhenRecalled_ShouldThrow() {
    Message recalled = savedMessage;
    recalled.setRecalled(true);
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(recalled));
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));

    assertThatThrownBy(() -> interactionService.pinMessage(SENDER_ID, MSG_ID))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("recalled");
  }

  @Test
  void unpinMessage_ShouldRemoveFromPinnedList() {
    conversation.setPinnedMessages(new java.util.ArrayList<>(List.of(MSG_ID)));
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(mongoTemplate.findAndModify(
            any(org.springframework.data.mongodb.core.query.Query.class),
            any(org.springframework.data.mongodb.core.query.UpdateDefinition.class),
            any(org.springframework.data.mongodb.core.FindAndModifyOptions.class),
            eq(Conversation.class)))
        .thenReturn(conversation.toBuilder().pinnedMessages(List.of()).build());
    // createSystemMessage persists the "X unpinned a message" notice.
    when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);

    var result = interactionService.unpinMessage(SENDER_ID, MSG_ID);

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
}
