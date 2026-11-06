package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PinResult;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.exception.MessageNotFoundException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.util.List;
import java.util.Optional;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.mongodb.core.query.UpdateDefinition;

/**
 * Reactions, delete-for-me and the permission / message-type rules of pin and unpin. The atomic
 * pin-limit write itself is covered by {@link MessagePinTest}.
 */
class MessageInteractionServiceTest {

  private static final String ALICE = "alice";
  private static final String BOB = "bob";
  private static final String MALLORY = "mallory";
  private static final String CONV = "c1";
  private static final String MSG = "m1";

  private final MessageRepository messageRepository = mock(MessageRepository.class);
  private final ConversationRepository conversationRepository = mock(ConversationRepository.class);
  private final MongoTemplate mongo = mock(MongoTemplate.class);
  private final MessageServiceHelper helper = mock(MessageServiceHelper.class);
  private final MessageService messageService = mock(MessageService.class);
  private final ConversationCacheService cache = mock(ConversationCacheService.class);
  private final MessageInteractionService service =
      new MessageInteractionService(
          messageRepository,
          conversationRepository,
          mongo,
          helper,
          new MessageMapper(),
          messageService,
          cache);

  private Message message(String type) {
    Message m = Message.builder().id(MSG).conversationId(CONV).senderId(BOB).type(type).build();
    when(messageRepository.findById(MSG)).thenReturn(Optional.of(m));
    return m;
  }

  private Conversation group(List<String> admins) {
    Conversation c =
        Conversation.builder()
            .id(CONV)
            .type("group")
            .participants(List.of(ALICE, BOB))
            .admins(admins)
            .build();
    when(conversationRepository.findById(CONV)).thenReturn(Optional.of(c));
    return c;
  }

  private Conversation direct() {
    Conversation c =
        Conversation.builder().id(CONV).type("direct").participants(List.of(ALICE, BOB)).build();
    when(conversationRepository.findById(CONV)).thenReturn(Optional.of(c));
    return c;
  }

  // --- reactions -------------------------------------------------------------

  @Test
  void reaction_blankOrOversizedIsRejectedBeforeAuthorization() {
    for (String bad : new String[] {null, "", "   ", "x".repeat(33)}) {
      assertThatThrownBy(() -> service.addReaction(ALICE, MSG, bad))
          .isInstanceOf(BadRequestException.class)
          .hasMessage("Invalid reaction");
    }
    verifyNoInteractions(helper, mongo);
  }

  @Test
  void reaction_nonParticipantIsForbiddenAndNothingWritten() {
    when(helper.requireParticipantMessage(MALLORY, MSG))
        .thenThrow(new ForbiddenException("Not a participant of this conversation"));
    assertThatThrownBy(() -> service.addReaction(MALLORY, MSG, "👍"))
        .isInstanceOf(ForbiddenException.class);
    assertThatThrownBy(() -> service.removeReaction(MALLORY, MSG))
        .isInstanceOf(ForbiddenException.class);
    verifyNoInteractions(mongo);
  }

  @Test
  void reaction_replacesExistingReactionInPlace() {
    Message updated =
        Message.builder()
            .id(MSG)
            .conversationId(CONV)
            .reactions(List.of(Message.Reaction.builder().userId(ALICE).emoji("❤️").build()))
            .build();
    when(mongo.findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Message.class)))
        .thenReturn(updated);

    MessageResponse res = service.addReaction(ALICE, MSG, "  ❤️ ");

    ArgumentCaptor<Query> q = ArgumentCaptor.forClass(Query.class);
    ArgumentCaptor<UpdateDefinition> u = ArgumentCaptor.forClass(UpdateDefinition.class);
    verify(mongo)
        .findAndModify(
            q.capture(), u.capture(), any(FindAndModifyOptions.class), eq(Message.class));
    assertThat(q.getValue().getQueryObject()).containsEntry("reactions.userId", ALICE);
    assertThat(((Update) u.getValue()).getUpdateObject())
        .isEqualTo(new Document("$set", new Document("reactions.$.emoji", "❤️")));
    assertThat(res.id()).isEqualTo(MSG);
  }

  @Test
  void reaction_appendsWhenUserHasNone() {
    Message updated = Message.builder().id(MSG).conversationId(CONV).build();
    when(mongo.findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Message.class)))
        .thenReturn(null, updated);

    service.addReaction(ALICE, MSG, "👍");

    ArgumentCaptor<Query> q = ArgumentCaptor.forClass(Query.class);
    ArgumentCaptor<UpdateDefinition> u = ArgumentCaptor.forClass(UpdateDefinition.class);
    verify(mongo, times(2))
        .findAndModify(
            q.capture(), u.capture(), any(FindAndModifyOptions.class), eq(Message.class));
    // Second step only matches messages the user has NOT reacted to → no duplicate.
    assertThat(q.getAllValues().get(1).getQueryObject())
        .containsEntry("reactions.userId", new Document("$ne", ALICE));
    Document push = (Document) ((Update) u.getAllValues().get(1)).getUpdateObject().get("$push");
    Message.Reaction r = (Message.Reaction) push.get("reactions");
    assertThat(r.getUserId()).isEqualTo(ALICE);
    assertThat(r.getEmoji()).isEqualTo("👍");
  }

  @Test
  void reaction_raceExhaustedFallsBackToReload() {
    when(mongo.findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Message.class)))
        .thenReturn(null);
    message("text");

    MessageResponse res = service.addReaction(ALICE, MSG, "👍");

    verify(mongo, times(6))
        .findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Message.class));
    assertThat(res.id()).isEqualTo(MSG);
  }

  @Test
  void removeReaction_pullsOnlyTheCallersReaction() {
    when(mongo.findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Message.class)))
        .thenReturn(Message.builder().id(MSG).build());

    service.removeReaction(ALICE, MSG);

    ArgumentCaptor<UpdateDefinition> u = ArgumentCaptor.forClass(UpdateDefinition.class);
    verify(mongo)
        .findAndModify(
            any(Query.class), u.capture(), any(FindAndModifyOptions.class), eq(Message.class));
    assertThat(((Update) u.getValue()).getUpdateObject())
        .isEqualTo(new Document("$pull", new Document("reactions", new Document("userId", ALICE))));
  }

  @Test
  void removeReaction_vanishedMessageIsNotFound() {
    when(mongo.findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Message.class)))
        .thenReturn(null);
    when(messageRepository.findById(MSG)).thenReturn(Optional.empty());
    assertThatThrownBy(() -> service.removeReaction(ALICE, MSG))
        .isInstanceOf(MessageNotFoundException.class);
  }

  // --- delete for me ---------------------------------------------------------

  @Test
  void deleteForMe_addsOnlyTheCallerToDeletedFor() {
    service.deleteForMe(ALICE, MSG);
    ArgumentCaptor<UpdateDefinition> u = ArgumentCaptor.forClass(UpdateDefinition.class);
    verify(mongo).updateFirst(any(Query.class), u.capture(), eq(Message.class));
    assertThat(((Update) u.getValue()).getUpdateObject())
        .isEqualTo(new Document("$addToSet", new Document("deletedFor", ALICE)));
  }

  @Test
  void deleteForMe_nonParticipantWritesNothing() {
    doThrow(new ForbiddenException("no")).when(helper).requireParticipantMessage(MALLORY, MSG);
    assertThatThrownBy(() -> service.deleteForMe(MALLORY, MSG))
        .isInstanceOf(ForbiddenException.class);
    verifyNoInteractions(mongo);
  }

  // --- pin rules ---------------------------------------------------------------

  @Test
  void pin_systemAndCallMessagesCannotBePinned() {
    direct();
    message("system");
    assertThatThrownBy(() -> service.pinMessage(ALICE, MSG))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("Cannot pin a system message");
    message("call_log");
    assertThatThrownBy(() -> service.pinMessage(ALICE, MSG))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("Cannot pin a call message");
    verify(mongo, never())
        .findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Conversation.class));
    verifyNoInteractions(messageService);
  }

  @Test
  void pin_nonAdminInGroupIsForbidden() {
    group(List.of(BOB));
    message("text");
    assertThatThrownBy(() -> service.pinMessage(ALICE, MSG))
        .isInstanceOfSatisfying(
            ForbiddenException.class,
            e -> assertThat(e.getCode()).isEqualTo(ErrorCodes.GROUP_ADMIN_REQUIRED));
    assertThatThrownBy(() -> service.unpinMessage(ALICE, MSG))
        .isInstanceOfSatisfying(
            ForbiddenException.class,
            e -> assertThat(e.getCode()).isEqualTo(ErrorCodes.GROUP_ADMIN_REQUIRED));
    verifyNoInteractions(messageService);
  }

  @Test
  void pin_groupWithoutAdminListRefusesEveryone() {
    group(null);
    message("text");
    assertThatThrownBy(() -> service.pinMessage(BOB, MSG)).isInstanceOf(ForbiddenException.class);
  }

  @Test
  void pin_adminInGroupPinsAndPostsNotice() {
    group(List.of(ALICE));
    message("text");
    when(mongo.findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Conversation.class)))
        .thenReturn(Conversation.builder().id(CONV).pinnedMessages(List.of(MSG)).build());

    PinResult res = service.pinMessage(ALICE, MSG);

    assertThat(res.pinnedMessages()).containsExactly(MSG);
    verify(messageService).createSystemMessage(CONV, "system.message.pinned:" + ALICE);
    verify(cache).evict(CONV);
  }

  @Test
  void unpin_nonParticipantIsForbidden() {
    direct();
    message("text");
    assertThatThrownBy(() -> service.unpinMessage(MALLORY, MSG))
        .isInstanceOf(ForbiddenException.class);
    verifyNoInteractions(mongo, messageService);
  }

  @Test
  void unpin_inDirectChatByParticipantPostsNotice_andToleratesVanishedConversation() {
    direct();
    message("text");
    when(mongo.findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Conversation.class)))
        .thenReturn(null);

    PinResult res = service.unpinMessage(BOB, MSG);

    assertThat(res.pinnedMessages()).isEmpty();
    verify(messageService).createSystemMessage(CONV, "system.message.unpinned:" + BOB);
  }

  @Test
  void pin_conversationWithNullParticipantsIsForbidden() {
    when(conversationRepository.findById(CONV))
        .thenReturn(Optional.of(Conversation.builder().id(CONV).type("direct").build()));
    message("text");
    assertThatThrownBy(() -> service.pinMessage(ALICE, MSG)).isInstanceOf(ForbiddenException.class);
  }
}
