package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.MessageRepository;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.UpdateDefinition;

/** Per-user state is a single atomic update on the caller's own key, guarded by membership. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ConversationUserStateServiceTest {

  private static final String USER = "user-001";
  private static final String CONV = "conv-001";

  @Mock private ConversationCacheService cache;
  @Mock private MongoTemplate mongoTemplate;
  @Mock private MessageRepository messageRepository;

  private ConversationUserStateService service;
  private ArgumentCaptor<UpdateDefinition> updates;
  private ArgumentCaptor<Query> queries;

  @BeforeEach
  void setUp() {
    ConversationWriteSupport support =
        new ConversationWriteSupport(
            cache, mongoTemplate, messageRepository, new ConversationMapper(messageRepository));
    service = new ConversationUserStateService(support, messageRepository, mongoTemplate);
    updates = ArgumentCaptor.forClass(UpdateDefinition.class);
    queries = ArgumentCaptor.forClass(Query.class);
  }

  private void updateReturns(Conversation result) {
    when(mongoTemplate.findAndModify(
            queries.capture(),
            updates.capture(),
            any(FindAndModifyOptions.class),
            eq(Conversation.class)))
        .thenReturn(result);
  }

  private static Conversation conv() {
    return Conversation.builder().id(CONV).participants(List.of(USER, "user-002")).build();
  }

  @Test
  void mute_setsOnlyTheCallersKey_guardedByMembership() {
    Map<String, Long> muted = new HashMap<>();
    muted.put(USER, System.currentTimeMillis() + 3_600_000L);
    updateReturns(conv().toBuilder().mutedUntil(muted).build());

    ConversationResponse view = service.mute(USER, CONV, 3600);

    Document set = updates.getValue().getUpdateObject().get("$set", Document.class);
    assertThat(set).containsKey("mutedUntil." + USER);
    assertThat(queries.getValue().getQueryObject().toJson()).contains("participants");
    assertThat(view.isMuted()).isTrue();
  }

  @Test
  void archive_and_unarchive_useAddToSetAndPull() {
    updateReturns(conv().toBuilder().archivedBy(List.of(USER)).build());

    assertThat(service.archive(USER, CONV).isArchived()).isTrue();
    assertThat(
            updates.getValue().getUpdateObject().get("$addToSet", Document.class).get("archivedBy"))
        .isEqualTo(USER);

    updateReturns(conv());
    assertThat(service.unarchive(USER, CONV).isArchived()).isFalse();
    assertThat(updates.getValue().getUpdateObject().get("$pull", Document.class).get("archivedBy"))
        .isEqualTo(USER);
  }

  @Test
  void clearHistory_and_delete_setTheCallersCutoff() {
    updateReturns(conv().toBuilder().clearedAt(Map.of(USER, Instant.now())).build());

    service.clearHistory(USER, CONV);
    assertThat(updates.getValue().getUpdateObject().get("$set", Document.class))
        .containsKey("clearedAt." + USER);

    service.deleteConversation(USER, CONV);
    Document update = updates.getValue().getUpdateObject();
    assertThat(update.get("$addToSet", Document.class).get("hiddenFor")).isEqualTo(USER);
    assertThat(update.get("$set", Document.class)).containsKey("clearedAt." + USER);
  }

  @Test
  void nonParticipant_is404() {
    updateReturns(null);

    assertThatThrownBy(() -> service.blockArchive("intruder", CONV))
        .isInstanceOf(ConversationNotFoundException.class);
  }

  @Test
  void dottedUserId_isRejectedBeforeBuildingAPath() {
    assertThatThrownBy(() -> service.mute("a.b", CONV, 60))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
