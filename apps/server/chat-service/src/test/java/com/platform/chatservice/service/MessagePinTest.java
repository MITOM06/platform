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

  // -----------------------------------------------------------------------
  // F3 — pin limit 5, never a silent eviction
  // -----------------------------------------------------------------------

  @Test
  void pinMessage_limitIsFive() {
    assertThat(MessageInteractionService.MAX_PINNED_MESSAGES).isEqualTo(5);
  }

  @Test
  void pinMessage_guardsTheLimitInTheSameAtomicWrite_andNeverSlices() {
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    org.mockito.ArgumentCaptor<org.springframework.data.mongodb.core.query.Query> query =
        org.mockito.ArgumentCaptor.forClass(
            org.springframework.data.mongodb.core.query.Query.class);
    org.mockito.ArgumentCaptor<org.springframework.data.mongodb.core.query.UpdateDefinition>
        update =
            org.mockito.ArgumentCaptor.forClass(
                org.springframework.data.mongodb.core.query.UpdateDefinition.class);
    when(mongoTemplate.findAndModify(
            query.capture(),
            update.capture(),
            any(org.springframework.data.mongodb.core.FindAndModifyOptions.class),
            eq(Conversation.class)))
        .thenReturn(conversation.toBuilder().pinnedMessages(List.of(MSG_ID)).build());
    when(messageRepository.save(any(Message.class))).thenReturn(savedMessage);

    interactionService.pinMessage(SENDER_ID, MSG_ID);

    String filter = query.getValue().getQueryObject().toJson();
    // re-pin of an already pinned message OR fewer than 5 pins
    assertThat(filter).contains("\"pinnedMessages\": \"" + MSG_ID + "\"");
    assertThat(filter).contains("\"pinnedMessages.4\": {\"$exists\": false}");
    String pipeline =
        ((org.springframework.data.mongodb.core.aggregation.AggregationUpdate) update.getValue())
            .toPipeline(
                org.springframework.data.mongodb.core.aggregation.Aggregation.DEFAULT_CONTEXT)
            .toString();
    assertThat(pipeline).contains("$concatArrays").doesNotContain("$slice");
  }

  @Test
  void pinMessage_atTheLimit_is409WithMaxParam_andPostsNoNotice() {
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(mongoTemplate.findAndModify(
            any(org.springframework.data.mongodb.core.query.Query.class),
            any(org.springframework.data.mongodb.core.query.UpdateDefinition.class),
            any(org.springframework.data.mongodb.core.FindAndModifyOptions.class),
            eq(Conversation.class)))
        .thenReturn(null);
    when(mongoTemplate.exists(
            any(org.springframework.data.mongodb.core.query.Query.class), eq(Conversation.class)))
        .thenReturn(true);

    assertThatThrownBy(() -> interactionService.pinMessage(SENDER_ID, MSG_ID))
        .isInstanceOf(com.platform.chatservice.exception.ApiException.class)
        .satisfies(
            e -> {
              var api = (com.platform.chatservice.exception.ApiException) e;
              assertThat(api.getStatus()).isEqualTo(org.springframework.http.HttpStatus.CONFLICT);
              assertThat(api.getCode())
                  .isEqualTo(com.platform.chatservice.exception.ErrorCodes.PIN_LIMIT_REACHED);
              assertThat(api.getParams()).containsEntry("max", 5);
            });
    verify(messageRepository, never()).save(any(Message.class));
  }

  @Test
  void pinMessage_whenConversationVanished_is404NotALimitError() {
    when(messageRepository.findById(MSG_ID)).thenReturn(Optional.of(savedMessage));
    when(conversationRepository.findById(CONV_ID)).thenReturn(Optional.of(conversation));
    when(mongoTemplate.exists(
            any(org.springframework.data.mongodb.core.query.Query.class), eq(Conversation.class)))
        .thenReturn(false);

    assertThatThrownBy(() -> interactionService.pinMessage(SENDER_ID, MSG_ID))
        .isInstanceOf(com.platform.chatservice.exception.ConversationNotFoundException.class);
  }

  // -----------------------------------------------------------------------
  // F4 — actor-attributed system notices
  // -----------------------------------------------------------------------

  @Test
  void createSystemMessage_fromActor_isSentByAndAlreadyReadByTheActor() {
    when(messageRepository.save(any(Message.class))).thenAnswer(inv -> inv.getArgument(0));

    MessageResponse notice =
        messageService.createSystemMessage(CONV_ID, "system.admin.promoted:" + OTHER_ID, SENDER_ID);

    assertThat(notice.type()).isEqualTo("system");
    assertThat(notice.senderId()).isEqualTo(SENDER_ID);
    assertThat(notice.content()).isEqualTo("system.admin.promoted:" + OTHER_ID);
    assertThat(notice.readBy()).containsExactly(SENDER_ID);
  }

  @Test
  void createSystemMessage_withoutActor_staysAnonymous() {
    when(messageRepository.save(any(Message.class))).thenAnswer(inv -> inv.getArgument(0));

    MessageResponse notice = messageService.createSystemMessage(CONV_ID, "system.group.created");

    assertThat(notice.senderId()).isEqualTo("system");
    assertThat(notice.readBy()).isEmpty();
  }
}
