package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.DuplicateConversationException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.ExternalBotRepository;
import com.platform.chatservice.repository.FriendshipRepository;
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

/**
 * Unit tests for the shared-state write side of the conversation domain ({@link
 * ConversationService}). Every mutation must be a single atomic {@code findAndModify} (never a
 * whole-document {@code save()}), admin-gated actions must answer {@code GROUP_ADMIN_REQUIRED}, and
 * membership changes must invalidate the STOMP membership cache. A real {@link ConversationMapper}
 * and {@link ConversationWriteSupport} run over mocked persistence.
 */
@ExtendWith(MockitoExtension.class)
class ConversationServiceTest {

  @Mock private ConversationRepository conversationRepository;
  @Mock private ConversationCacheService conversationCacheService;
  @Mock private MessageRepository messageRepository;
  @Mock private FriendshipRepository friendshipRepository;
  @Mock private MongoTemplate mongoTemplate;
  @Mock private ExternalBotRepository externalBotRepository;
  @Mock private ConversationMembershipCache membershipCache;

  private ConversationService conversationService;

  private static final String USER_ID = "user-001";
  private static final String OTHER_ID = "user-002";
  private static final String THIRD_ID = "user-003";
  private static final String CONV_ID = "conv-001";

  private Conversation conversation;

  @BeforeEach
  void setUp() {
    ConversationMapper conversationMapper = new ConversationMapper(messageRepository);
    ConversationWriteSupport support =
        new ConversationWriteSupport(
            conversationCacheService, mongoTemplate, messageRepository, conversationMapper);
    conversationService =
        new ConversationService(
            conversationRepository,
            conversationCacheService,
            friendshipRepository,
            externalBotRepository,
            support,
            membershipCache);

    conversation =
        Conversation.builder()
            .id(CONV_ID)
            .participants(List.of(USER_ID, OTHER_ID))
            .createdAt(Instant.now())
            .build();
  }

  private Conversation group(String... admins) {
    return Conversation.builder()
        .id(CONV_ID)
        .type(Conversation.TYPE_GROUP)
        .name("Team")
        .participants(new ArrayList<>(List.of(USER_ID, OTHER_ID, THIRD_ID)))
        .admins(new ArrayList<>(List.of(admins)))
        .createdBy(USER_ID)
        .createdAt(Instant.now())
        .build();
  }

  private void found(Conversation c) {
    when(conversationCacheService.findByIdOptional(CONV_ID)).thenReturn(Optional.of(c));
  }

  /** Stub every atomic update to return {@code result}; returns the captor of the updates. */
  private ArgumentCaptor<UpdateDefinition> updatesReturning(Conversation result) {
    ArgumentCaptor<UpdateDefinition> captor = ArgumentCaptor.forClass(UpdateDefinition.class);
    when(mongoTemplate.findAndModify(
            any(Query.class),
            captor.capture(),
            any(FindAndModifyOptions.class),
            eq(Conversation.class)))
        .thenReturn(result);
    return captor;
  }

  private static Document op(UpdateDefinition update, String operator) {
    return update.getUpdateObject().get(operator, Document.class);
  }

  // ------------------------------------------------------------------ create

  @Test
  void createConversation_ShouldSaveAndReturnResponse() {
    when(conversationRepository.findOneOnOneConversations(any())).thenReturn(List.of());
    when(conversationCacheService.save(any(Conversation.class))).thenReturn(conversation);

    ConversationResponse response = conversationService.createConversation(USER_ID, OTHER_ID);

    assertThat(response.id()).isEqualTo(CONV_ID);
    assertThat(response.participants()).containsExactlyInAnyOrder(USER_ID, OTHER_ID);
    assertThat(response.unreadCount()).isZero();
  }

  @Test
  void createConversation_WhenDuplicate_ShouldThrowAndNotSave() {
    when(conversationRepository.findOneOnOneConversations(any())).thenReturn(List.of(conversation));

    assertThatThrownBy(() -> conversationService.createConversation(USER_ID, OTHER_ID))
        .isInstanceOf(DuplicateConversationException.class)
        .extracting("conversationId")
        .isEqualTo(CONV_ID);

    verify(conversationCacheService, never()).save(any());
  }

  @Test
  void createConversation_WhenNotFriends_ShouldBePending() {
    when(conversationRepository.findOneOnOneConversations(any())).thenReturn(List.of());
    when(conversationCacheService.save(any(Conversation.class))).thenReturn(conversation);

    conversationService.createConversation(USER_ID, OTHER_ID);

    var captor = ArgumentCaptor.forClass(Conversation.class);
    verify(conversationCacheService).save(captor.capture());
    assertThat(captor.getValue().getStatus()).isEqualTo(Conversation.STATUS_PENDING);
  }

  @Test
  void createConversation_WhenFriends_ShouldBeAccepted() {
    when(conversationRepository.findOneOnOneConversations(any())).thenReturn(List.of());
    when(friendshipRepository.findAcceptedBetween(USER_ID, OTHER_ID))
        .thenReturn(Optional.of(new com.platform.chatservice.model.Friendship()));
    when(conversationCacheService.save(any(Conversation.class))).thenReturn(conversation);

    conversationService.createConversation(USER_ID, OTHER_ID);

    var captor = ArgumentCaptor.forClass(Conversation.class);
    verify(conversationCacheService).save(captor.capture());
    assertThat(captor.getValue().getStatus()).isEqualTo(Conversation.STATUS_ACCEPTED);
  }

  @Test
  void createConversation_withExternalBot_isAutoAccepted() {
    when(conversationRepository.findOneOnOneConversations(any())).thenReturn(List.of());
    when(externalBotRepository.findByBotUserId("extbot:bf-1"))
        .thenReturn(
            Optional.of(
                com.platform.chatservice.model.ExternalBot.builder()
                    .botUserId("extbot:bf-1")
                    .enabled(true)
                    .build()));
    ArgumentCaptor<Conversation> captor = ArgumentCaptor.forClass(Conversation.class);
    when(conversationCacheService.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

    conversationService.createConversation(USER_ID, "extbot:bf-1");

    assertThat(captor.getValue().getStatus()).isEqualTo(Conversation.STATUS_ACCEPTED);
    verifyNoInteractions(friendshipRepository);
  }

  // ------------------------------------------------------------------ accept / get

  @Test
  void acceptConversation_ByRecipient_ShouldSetAcceptedAtomically() {
    Conversation pending =
        Conversation.builder()
            .id(CONV_ID)
            .participants(List.of(USER_ID, OTHER_ID))
            .createdBy(USER_ID)
            .status(Conversation.STATUS_PENDING)
            .createdAt(Instant.now())
            .build();
    found(pending);
    Conversation accepted = pending.toBuilder().status(Conversation.STATUS_ACCEPTED).build();
    var updates = updatesReturning(accepted);
    when(messageRepository.countUnread(CONV_ID, OTHER_ID)).thenReturn(0L);

    ConversationResponse response = conversationService.acceptConversation(OTHER_ID, CONV_ID);

    assertThat(response.status()).isEqualTo(Conversation.STATUS_ACCEPTED);
    assertThat(op(updates.getValue(), "$set").get("status"))
        .isEqualTo(Conversation.STATUS_ACCEPTED);
    verify(conversationCacheService, never()).save(any());
    verify(conversationCacheService).evict(CONV_ID);
  }

  @Test
  void acceptConversation_ByInitiator_ShouldThrow() {
    Conversation pending =
        Conversation.builder()
            .id(CONV_ID)
            .participants(List.of(USER_ID, OTHER_ID))
            .createdBy(USER_ID)
            .status(Conversation.STATUS_PENDING)
            .createdAt(Instant.now())
            .build();
    found(pending);

    assertThatThrownBy(() -> conversationService.acceptConversation(USER_ID, CONV_ID))
        .isInstanceOf(ForbiddenException.class);
    verifyNoInteractions(mongoTemplate);
  }

  @Test
  void getConversation_ShouldReturnConversation() {
    found(conversation);
    when(messageRepository.countUnread(CONV_ID, USER_ID)).thenReturn(3L);

    ConversationResponse response = conversationService.getConversation(USER_ID, CONV_ID);

    assertThat(response.id()).isEqualTo(CONV_ID);
    assertThat(response.unreadCount()).isEqualTo(3L);
  }

  @Test
  void getConversation_WhenUserNotParticipant_ShouldThrow() {
    found(conversation);

    assertThatThrownBy(() -> conversationService.getConversation("intruder-999", CONV_ID))
        .isInstanceOf(ConversationNotFoundException.class);
  }

  @Test
  void getConversation_WhenNotFound_ShouldThrow() {
    when(conversationCacheService.findByIdOptional(CONV_ID)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> conversationService.getConversation(USER_ID, CONV_ID))
        .isInstanceOf(ConversationNotFoundException.class);
  }

  // ------------------------------------------------------------------ disappearing messages

  /** E2E: a non-admin group member could switch it on (and the sweep then wiped the history). */
  @Test
  void setAutoDelete_InGroup_ByNonAdmin_IsForbiddenWithCode() {
    found(group(USER_ID));

    assertThatThrownBy(() -> conversationService.setAutoDelete(OTHER_ID, CONV_ID, 86_400))
        .isInstanceOf(ForbiddenException.class)
        .extracting("code")
        .isEqualTo(ErrorCodes.GROUP_ADMIN_REQUIRED);
    verifyNoInteractions(mongoTemplate);
  }

  @Test
  void setAutoDelete_InGroup_ByAdmin_EnablesAndStampsEnabledAt() {
    Conversation g = group(USER_ID);
    found(g);
    Instant before = Instant.now();
    var updates =
        updatesReturning(
            g.toBuilder().autoDeleteSeconds(86_400).autoDeleteEnabledAt(Instant.now()).build());

    ConversationService.AutoDeleteChange change =
        conversationService.setAutoDelete(USER_ID, CONV_ID, 86_400);

    assertThat(change.changed()).isTrue();
    assertThat(change.seconds()).isEqualTo(86_400);
    Document set = op(updates.getValue(), "$set");
    assertThat(set.get("autoDeleteSeconds")).isEqualTo(86_400);
    assertThat((Instant) set.get("autoDeleteEnabledAt")).isAfterOrEqualTo(before);
    assertThat(change.conversation().autoDeleteSeconds()).isEqualTo(86_400);
    assertThat(change.conversation().autoDeleteEnabledAt()).isNotNull();
  }

  @Test
  void setAutoDelete_InDirectChat_AnyParticipantMayEnable() {
    found(conversation);
    var updates = updatesReturning(conversation.toBuilder().autoDeleteSeconds(3600).build());

    ConversationService.AutoDeleteChange change =
        conversationService.setAutoDelete(OTHER_ID, CONV_ID, 3600);

    assertThat(change.changed()).isTrue();
    assertThat(op(updates.getValue(), "$set")).containsKey("autoDeleteEnabledAt");
  }

  /** Changing the window while enabled keeps the original instant (messages since then follow). */
  @Test
  void setAutoDelete_ChangingWindow_KeepsEnabledAt() {
    Instant enabledAt = Instant.parse("2026-10-01T00:00:00Z");
    Conversation g =
        group(USER_ID).toBuilder().autoDeleteSeconds(86_400).autoDeleteEnabledAt(enabledAt).build();
    found(g);
    var updates = updatesReturning(g.toBuilder().autoDeleteSeconds(3600).build());

    conversationService.setAutoDelete(USER_ID, CONV_ID, 3600);

    Document set = op(updates.getValue(), "$set");
    assertThat(set.get("autoDeleteSeconds")).isEqualTo(3600);
    assertThat(set).doesNotContainKey("autoDeleteEnabledAt");
  }

  @Test
  void setAutoDelete_Disabling_UnsetsBothFields() {
    Conversation g =
        group(USER_ID).toBuilder()
            .autoDeleteSeconds(3600)
            .autoDeleteEnabledAt(Instant.now())
            .build();
    found(g);
    var updates = updatesReturning(group(USER_ID));

    ConversationService.AutoDeleteChange change =
        conversationService.setAutoDelete(USER_ID, CONV_ID, 0);

    assertThat(change.changed()).isTrue();
    assertThat(change.seconds()).isZero();
    assertThat(op(updates.getValue(), "$unset"))
        .containsKeys("autoDeleteSeconds", "autoDeleteEnabledAt");
  }

  @Test
  void setAutoDelete_SameValue_IsANoOp() {
    Conversation g =
        group(USER_ID).toBuilder()
            .autoDeleteSeconds(3600)
            .autoDeleteEnabledAt(Instant.now())
            .build();
    found(g);

    ConversationService.AutoDeleteChange change =
        conversationService.setAutoDelete(USER_ID, CONV_ID, 3600);

    assertThat(change.changed()).isFalse();
    verifyNoInteractions(mongoTemplate);
  }

  /** Enabled before the field existed: re-saving the same value starts the clock now. */
  @Test
  void setAutoDelete_LegacyEnabledWithoutInstant_StampsIt() {
    Conversation legacy = group(USER_ID).toBuilder().autoDeleteSeconds(3600).build();
    found(legacy);
    var updates = updatesReturning(legacy);

    ConversationService.AutoDeleteChange change =
        conversationService.setAutoDelete(USER_ID, CONV_ID, 3600);

    assertThat(change.changed()).isTrue();
    assertThat(op(updates.getValue(), "$set")).containsKey("autoDeleteEnabledAt");
  }

  // ------------------------------------------------------------------ members

  @Test
  void addMembers_AddsOnlyNewcomers_AsPending_Atomically_AndInvalidatesMembership() {
    Conversation g = group(USER_ID);
    found(g);
    var updates = updatesReturning(g);

    conversationService.addMembers(USER_ID, CONV_ID, List.of(OTHER_ID, "user-004", "user-004"));

    Document addToSet = op(updates.getValue(), "$addToSet");
    Object[] participants =
        (Object[])
            ((org.springframework.data.mongodb.core.query.Update.Modifier)
                    addToSet.get("participants"))
                .getValue();
    Object[] pending =
        (Object[])
            ((org.springframework.data.mongodb.core.query.Update.Modifier)
                    addToSet.get("pendingMembers"))
                .getValue();
    assertThat(participants).containsExactly("user-004");
    assertThat(pending).containsExactly("user-004");
    verify(membershipCache).invalidate(CONV_ID);
    verify(conversationCacheService, never()).save(any());
  }

  @Test
  void addMembers_ByNonAdmin_IsForbiddenWithCode() {
    found(group(USER_ID));

    assertThatThrownBy(() -> conversationService.addMembers(OTHER_ID, CONV_ID, List.of("u-9")))
        .isInstanceOf(ForbiddenException.class)
        .extracting("code")
        .isEqualTo(ErrorCodes.GROUP_ADMIN_REQUIRED);
  }

  @Test
  void removeMember_OtherByNonAdmin_IsForbiddenWithCode() {
    found(group(USER_ID));

    assertThatThrownBy(() -> conversationService.removeMember(OTHER_ID, CONV_ID, THIRD_ID))
        .isInstanceOf(ForbiddenException.class)
        .extracting("code")
        .isEqualTo(ErrorCodes.GROUP_ADMIN_REQUIRED);
    verifyNoInteractions(mongoTemplate);
  }

  @Test
  void removeMember_PullsTargetFromEveryList_AndInvalidatesMembership() {
    Conversation g = group(USER_ID);
    found(g);
    Conversation after = g.toBuilder().participants(List.of(USER_ID, OTHER_ID)).build();
    var updates = updatesReturning(after);

    ConversationResponse response = conversationService.removeMember(USER_ID, CONV_ID, THIRD_ID);

    Document pull = op(updates.getValue(), "$pull");
    assertThat(pull.get("participants")).isEqualTo(THIRD_ID);
    assertThat(pull.get("admins")).isEqualTo(THIRD_ID);
    assertThat(pull.get("pendingMembers")).isEqualTo(THIRD_ID);
    assertThat(response.participants()).doesNotContain(THIRD_ID);
    verify(membershipCache).invalidate(CONV_ID);
  }

  /** The last admin leaving promotes the first remaining HUMAN member (never a bot). */
  @Test
  void removeMember_LastAdminLeaving_PromotesFirstHuman_OnlyIfStillNoAdmin() {
    Conversation g = group(USER_ID);
    found(g);
    Conversation afterLeave =
        g.toBuilder()
            .participants(List.of(AiConstants.AI_BOT_USER_ID, OTHER_ID, THIRD_ID))
            .admins(new ArrayList<>())
            .build();
    Conversation promoted = afterLeave.toBuilder().admins(List.of(OTHER_ID)).build();
    ArgumentCaptor<Query> queries = ArgumentCaptor.forClass(Query.class);
    ArgumentCaptor<UpdateDefinition> updates = ArgumentCaptor.forClass(UpdateDefinition.class);
    when(mongoTemplate.findAndModify(
            queries.capture(),
            updates.capture(),
            any(FindAndModifyOptions.class),
            eq(Conversation.class)))
        .thenReturn(afterLeave, promoted);

    ConversationResponse response = conversationService.removeMember(USER_ID, CONV_ID, USER_ID);

    assertThat(response.admins()).containsExactly(OTHER_ID);
    assertThat(op(updates.getAllValues().get(1), "$push").get("admins")).isEqualTo(OTHER_ID);
    // The promotion is conditional on the group STILL having no admin.
    assertThat(queries.getAllValues().get(1).getQueryObject().toJson()).contains("admins");
  }

  @Test
  void removeMember_SelfLeave_IsAllowedForNonAdmins() {
    Conversation g = group(USER_ID);
    found(g);
    updatesReturning(g.toBuilder().participants(List.of(USER_ID, THIRD_ID)).build());

    ConversationResponse response = conversationService.removeMember(OTHER_ID, CONV_ID, OTHER_ID);

    assertThat(response.participants()).containsExactly(USER_ID, THIRD_ID);
  }

  @Test
  void joinChannel_AddsCallerAtomically_AndInvalidatesMembership() {
    Conversation channel = group(USER_ID).toBuilder().publicChannel(true).build();
    found(channel);
    var updates = updatesReturning(channel);

    conversationService.joinChannel("user-009", CONV_ID);

    assertThat(op(updates.getValue(), "$addToSet").get("participants")).isEqualTo("user-009");
    verify(membershipCache).invalidate(CONV_ID);
  }

  @Test
  void joinChannel_PrivateGroup_IsForbidden() {
    found(group(USER_ID));

    assertThatThrownBy(() -> conversationService.joinChannel("user-009", CONV_ID))
        .isInstanceOf(ForbiddenException.class);
    verifyNoInteractions(mongoTemplate);
  }

  // ------------------------------------------------------------------ group info / wallpaper

  @Test
  void updateGroup_SetsNameAndUnsetsBlankAvatar_Atomically() {
    Conversation g = group(USER_ID).toBuilder().avatarUrl("/a.png").build();
    found(g);
    var updates = updatesReturning(g.toBuilder().name("New").avatarUrl(null).build());

    ConversationResponse response = conversationService.updateGroup(USER_ID, CONV_ID, " New ", "");

    assertThat(op(updates.getValue(), "$set").get("name")).isEqualTo("New");
    assertThat(op(updates.getValue(), "$unset")).containsKey("avatarUrl");
    assertThat(response.name()).isEqualTo("New");
  }

  @Test
  void setWallpaper_AnyParticipant_SetsOrResets() {
    var updates = updatesReturning(conversation.toBuilder().wallpaper("preset:x").build());

    conversationService.setWallpaper(OTHER_ID, CONV_ID, "preset:x");
    conversationService.setWallpaper(OTHER_ID, CONV_ID, " ");

    assertThat(op(updates.getAllValues().get(0), "$set").get("wallpaper")).isEqualTo("preset:x");
    assertThat(op(updates.getAllValues().get(1), "$unset")).containsKey("wallpaper");
  }

  @Test
  void setWallpaper_ByNonParticipant_Is404() {
    when(mongoTemplate.findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Conversation.class)))
        .thenReturn(null);

    assertThatThrownBy(() -> conversationService.setWallpaper("intruder", CONV_ID, "preset:x"))
        .isInstanceOf(ConversationNotFoundException.class);
  }
}
