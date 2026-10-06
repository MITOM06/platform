package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.MessageRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.UpdateDefinition;
import org.springframework.http.HttpStatus;

/**
 * F4 promote / demote rules over a real {@link ConversationWriteSupport} + {@link
 * ConversationMapper} and mocked persistence: guarded atomic {@code $addToSet} / {@code $pull},
 * idempotent no-ops, last-admin protection, and the stable error codes.
 */
@ExtendWith(MockitoExtension.class)
class GroupAdminServiceTest {

  private static final String CONV = "conv-1";
  private static final String ADMIN = "admin-1";
  private static final String MEMBER = "member-1";
  private static final String OTHER_ADMIN = "admin-2";

  @Mock private ConversationCacheService cache;
  @Mock private MongoTemplate mongoTemplate;
  @Mock private MessageRepository messageRepository;

  private GroupAdminService service;

  @BeforeEach
  void setUp() {
    ConversationWriteSupport support =
        new ConversationWriteSupport(
            cache, mongoTemplate, messageRepository, new ConversationMapper(messageRepository));
    service = new GroupAdminService(support);
  }

  private static Conversation group(String... admins) {
    return Conversation.builder()
        .id(CONV)
        .type(Conversation.TYPE_GROUP)
        .name("Team")
        .participants(
            new ArrayList<>(
                List.of(ADMIN, MEMBER, OTHER_ADMIN, AiConstants.AI_BOT_USER_ID, "extbot:b1")))
        .admins(new ArrayList<>(List.of(admins)))
        .createdAt(Instant.now())
        .build();
  }

  private void found(Conversation c) {
    when(cache.findByIdOptional(CONV)).thenReturn(Optional.of(c));
  }

  private ArgumentCaptor<Query> queries(Conversation result, ArgumentCaptor<UpdateDefinition> u) {
    ArgumentCaptor<Query> q = ArgumentCaptor.forClass(Query.class);
    when(mongoTemplate.findAndModify(
            q.capture(), u.capture(), any(FindAndModifyOptions.class), eq(Conversation.class)))
        .thenReturn(result);
    return q;
  }

  private static Document filterOf(Query query) {
    // support.update wraps the guard as {$and: [{_id}, guard]}
    @SuppressWarnings("unchecked")
    List<Document> and = (List<Document>) query.getQueryObject().get("$and");
    return and.get(1);
  }

  // ---------------------------------------------------------------- promote

  @Test
  void promote_addsToSetAtomically_guardedByCallerStillAdminAndTargetStillMember() {
    found(group(ADMIN));
    Conversation after = group(ADMIN, MEMBER);
    ArgumentCaptor<UpdateDefinition> update = ArgumentCaptor.forClass(UpdateDefinition.class);
    ArgumentCaptor<Query> query = queries(after, update);

    GroupAdminService.AdminChange change = service.promote(ADMIN, CONV, MEMBER);

    assertThat(change.changed()).isTrue();
    assertThat(change.conversation().admins()).containsExactly(ADMIN, MEMBER);
    Document guard = filterOf(query.getValue());
    assertThat(guard).containsEntry("admins", ADMIN).containsEntry("participants", MEMBER);
    assertThat(update.getValue().getUpdateObject().get("$addToSet", Document.class))
        .containsEntry("admins", MEMBER);
    verify(cache).evict(CONV);
  }

  @Test
  void promote_existingAdmin_isIdempotentNoOp() {
    found(group(ADMIN, MEMBER));

    GroupAdminService.AdminChange change = service.promote(ADMIN, CONV, MEMBER);

    assertThat(change.changed()).isFalse();
    verify(mongoTemplate, never())
        .findAndModify(
            any(Query.class), any(UpdateDefinition.class), any(FindAndModifyOptions.class), any());
  }

  @Test
  void promote_byNonAdmin_isForbiddenWithCode() {
    found(group(ADMIN));

    assertThatThrownBy(() -> service.promote(MEMBER, CONV, OTHER_ADMIN))
        .isInstanceOf(ForbiddenException.class)
        .extracting("code")
        .isEqualTo(ErrorCodes.GROUP_ADMIN_REQUIRED);
  }

  @Test
  void promote_nonMemberOrBot_isNotAMember404() {
    found(group(ADMIN));

    for (String target : List.of("stranger", AiConstants.AI_BOT_USER_ID, "extbot:b1")) {
      assertThatThrownBy(() -> service.promote(ADMIN, CONV, target))
          .isInstanceOf(ApiException.class)
          .satisfies(
              e -> {
                ApiException api = (ApiException) e;
                assertThat(api.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(api.getCode()).isEqualTo(ErrorCodes.NOT_A_MEMBER);
              });
    }
  }

  @Test
  void promote_inDirectChat_isNotAGroup400() {
    found(
        Conversation.builder()
            .id(CONV)
            .type(Conversation.TYPE_DIRECT)
            .participants(List.of(ADMIN, MEMBER))
            .build());

    assertThatThrownBy(() -> service.promote(ADMIN, CONV, MEMBER))
        .isInstanceOf(BadRequestException.class)
        .extracting("code")
        .isEqualTo(ErrorCodes.NOT_A_GROUP);
  }

  @Test
  void promote_byNonParticipant_is404() {
    found(group(ADMIN));

    assertThatThrownBy(() -> service.promote("outsider", CONV, MEMBER))
        .isInstanceOf(ConversationNotFoundException.class);
  }

  @Test
  void promote_raceLost_rereadsAndReportsTheNewState() {
    // First read: caller is admin. The guarded write misses (caller demoted concurrently); the
    // re-read shows the caller is no longer admin → 403.
    when(cache.findByIdOptional(CONV))
        .thenReturn(Optional.of(group(ADMIN, OTHER_ADMIN)), Optional.of(group(OTHER_ADMIN)));
    when(mongoTemplate.findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Conversation.class)))
        .thenReturn(null);

    assertThatThrownBy(() -> service.promote(ADMIN, CONV, MEMBER))
        .isInstanceOf(ForbiddenException.class);
  }

  // ---------------------------------------------------------------- demote

  @Test
  void demote_pullsAtomically_guardedByBothAdminsAndAtLeastTwoAdmins() {
    found(group(ADMIN, OTHER_ADMIN));
    ArgumentCaptor<UpdateDefinition> update = ArgumentCaptor.forClass(UpdateDefinition.class);
    ArgumentCaptor<Query> query = queries(group(ADMIN), update);

    GroupAdminService.AdminChange change = service.demote(ADMIN, CONV, OTHER_ADMIN);

    assertThat(change.changed()).isTrue();
    Document guard = filterOf(query.getValue());
    assertThat(guard.get("admins", Document.class).get("$all", List.class))
        .containsExactly(ADMIN, OTHER_ADMIN);
    assertThat(guard.get("admins.1", Document.class)).containsEntry("$exists", true);
    assertThat(update.getValue().getUpdateObject().get("$pull", Document.class))
        .containsEntry("admins", OTHER_ADMIN);
  }

  @Test
  void demote_selfWhileAnotherAdminExists_isAllowed() {
    found(group(ADMIN, OTHER_ADMIN));
    queries(group(OTHER_ADMIN), ArgumentCaptor.forClass(UpdateDefinition.class));

    GroupAdminService.AdminChange change = service.demote(ADMIN, CONV, ADMIN);

    assertThat(change.changed()).isTrue();
    // The caller is no longer admin in the returned view.
    assertThat(change.conversation().admins()).containsExactly(OTHER_ADMIN);
  }

  @Test
  void demote_theOnlyAdmin_isConflictWithCode() {
    found(group(ADMIN));

    assertThatThrownBy(() -> service.demote(ADMIN, CONV, ADMIN))
        .isInstanceOf(ApiException.class)
        .satisfies(
            e -> {
              ApiException api = (ApiException) e;
              assertThat(api.getStatus()).isEqualTo(HttpStatus.CONFLICT);
              assertThat(api.getCode()).isEqualTo(ErrorCodes.LAST_ADMIN_CANNOT_BE_REMOVED);
            });
    verify(mongoTemplate, never())
        .findAndModify(
            any(Query.class), any(UpdateDefinition.class), any(FindAndModifyOptions.class), any());
  }

  @Test
  void demote_nonAdmin_isIdempotentNoOp() {
    found(group(ADMIN));

    assertThat(service.demote(ADMIN, CONV, MEMBER).changed()).isFalse();
  }

  @Test
  void demote_nonMember_isNotAMember404() {
    found(group(ADMIN, OTHER_ADMIN));

    assertThatThrownBy(() -> service.demote(ADMIN, CONV, "stranger"))
        .isInstanceOf(ApiException.class)
        .extracting("code")
        .isEqualTo(ErrorCodes.NOT_A_MEMBER);
  }

  @Test
  void demote_twoAdminsDemotingEachOther_theLoserGetsLastAdmin409() {
    // Both saw [ADMIN, OTHER_ADMIN]; the other demotion landed first, so the guarded $pull misses
    // and the re-read shows ADMIN as the only admin left → 409, never an admin-less group.
    when(cache.findByIdOptional(CONV))
        .thenReturn(Optional.of(group(ADMIN, OTHER_ADMIN)), Optional.of(group(ADMIN)));
    when(mongoTemplate.findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Conversation.class)))
        .thenReturn(null);

    assertThatThrownBy(() -> service.demote(ADMIN, CONV, ADMIN))
        .isInstanceOf(ApiException.class)
        .extracting("code")
        .isEqualTo(ErrorCodes.LAST_ADMIN_CANNOT_BE_REMOVED);
  }
}
