package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.mongodb.client.result.UpdateResult;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.mongodb.core.query.UpdateDefinition;

/**
 * Disappearing messages: only messages created after the setting was switched on AND older than the
 * window are deleted; quotes lose their text; the conversation preview is refreshed only if it
 * still mirrors a swept message.
 */
class MessageSweepServiceTest {

  private static final Instant NOW = Instant.parse("2026-11-06T12:00:00Z");
  private static final String CONV = "c1";

  private final MongoTemplate mongo = mock(MongoTemplate.class);
  private final ConversationCacheService cache = mock(ConversationCacheService.class);
  private final ConversationEventPublisher events = mock(ConversationEventPublisher.class);
  private final MessageSweepService sweep = new MessageSweepService(mongo, cache, events);

  private static Conversation conv(Integer seconds, Instant enabledAt) {
    return Conversation.builder()
        .id(CONV)
        .autoDeleteSeconds(seconds)
        .autoDeleteEnabledAt(enabledAt)
        .build();
  }

  private static List<Message> ids(int n, int offset) {
    return IntStream.range(0, n)
        .mapToObj(i -> Message.builder().id("m" + (offset + i)).build())
        .toList();
  }

  @Test
  void disabledOrUnstampedConversationIsNeverSwept() {
    sweep.sweep(conv(null, NOW.minusSeconds(9999)), NOW);
    sweep.sweep(conv(0, NOW.minusSeconds(9999)), NOW);
    sweep.sweep(conv(60, null), NOW);
    verifyNoInteractions(mongo, events);
  }

  @Test
  void windowNotYetElapsedSinceEnablingDeletesNothing() {
    // Enabled 30 s ago with a 60 s window: cutoff (now-60s) is before enabledAt.
    sweep.sweep(conv(60, NOW.minusSeconds(30)), NOW);
    // Exactly at the boundary: cutoff == enabledAt is not "after".
    sweep.sweep(conv(60, NOW.minusSeconds(60)), NOW);
    verifyNoInteractions(mongo);
  }

  @Test
  void deletesOnlyMessagesBetweenEnabledAtAndCutoff_andBlanksQuotes() {
    Instant enabledAt = NOW.minusSeconds(3600);
    when(mongo.find(any(Query.class), eq(Message.class))).thenReturn(ids(2, 0));
    when(mongo.updateFirst(any(Query.class), any(UpdateDefinition.class), eq(Conversation.class)))
        .thenReturn(UpdateResult.acknowledged(1, 1L, null));
    when(mongo.findOne(any(Query.class), eq(Message.class)))
        .thenReturn(
            Message.builder()
                .id("m9")
                .content("still here")
                .createdAt(NOW.minusSeconds(5))
                .build());

    sweep.sweep(conv(60, enabledAt), NOW);

    ArgumentCaptor<Query> find = ArgumentCaptor.forClass(Query.class);
    verify(mongo).find(find.capture(), eq(Message.class));
    Document created = (Document) find.getValue().getQueryObject().get("createdAt");
    assertThat(created.get("$gte")).isEqualTo(enabledAt);
    assertThat(created.get("$lt")).isEqualTo(NOW.minusSeconds(60));
    assertThat(find.getValue().getQueryObject()).containsEntry("conversationId", CONV);
    assertThat(find.getValue().getLimit()).isEqualTo(MessageSweepService.BATCH_SIZE);

    ArgumentCaptor<Query> removed = ArgumentCaptor.forClass(Query.class);
    verify(mongo).remove(removed.capture(), eq(Message.class));
    assertThat(removed.getValue().getQueryObject())
        .isEqualTo(new Document("_id", new Document("$in", List.of("m0", "m1"))));

    ArgumentCaptor<UpdateDefinition> quotes = ArgumentCaptor.forClass(UpdateDefinition.class);
    verify(mongo).updateMulti(any(Query.class), quotes.capture(), eq(Message.class));
    assertThat(((Update) quotes.getValue()).getUpdateObject())
        .isEqualTo(new Document("$set", new Document("replyPreview.content", "")));

    ArgumentCaptor<UpdateDefinition> preview = ArgumentCaptor.forClass(UpdateDefinition.class);
    verify(mongo).updateFirst(any(Query.class), preview.capture(), eq(Conversation.class));
    Document set = (Document) ((Update) preview.getValue()).getUpdateObject().get("$set");
    assertThat(set.get("lastMessageAt")).isEqualTo(NOW.minusSeconds(5));
    assertThat(((Conversation.LastMessage) set.get("lastMessage")).getMessageId()).isEqualTo("m9");
    verify(cache).evict(CONV);
    verify(events).publishShared(CONV);
  }

  @Test
  void emptyConversationAfterSweepUnsetsPreview_andNoEventWhenGuardDidNotMatch() {
    when(mongo.find(any(Query.class), eq(Message.class))).thenReturn(ids(1, 0));
    when(mongo.findOne(any(Query.class), eq(Message.class))).thenReturn(null);
    // A newer message arrived meanwhile → guarded update matches nothing.
    when(mongo.updateFirst(any(Query.class), any(UpdateDefinition.class), eq(Conversation.class)))
        .thenReturn(UpdateResult.acknowledged(0, 0L, null));

    sweep.sweep(conv(60, NOW.minusSeconds(3600)), NOW);

    ArgumentCaptor<UpdateDefinition> preview = ArgumentCaptor.forClass(UpdateDefinition.class);
    verify(mongo).updateFirst(any(Query.class), preview.capture(), eq(Conversation.class));
    assertThat(((Update) preview.getValue()).getUpdateObject().get("$unset", Document.class))
        .containsKeys("lastMessage", "lastMessageAt");
    verify(cache).evict(CONV);
    verify(events, never()).publishShared(any(String.class));
  }

  @Test
  void nothingExpiredMeansNoWritesAndNoEvent() {
    when(mongo.find(any(Query.class), eq(Message.class))).thenReturn(List.of());
    sweep.sweep(conv(60, NOW.minusSeconds(3600)), NOW);
    verify(mongo, never()).remove(any(Query.class), eq(Message.class));
    verify(mongo, never())
        .updateFirst(any(Query.class), any(UpdateDefinition.class), eq(Conversation.class));
    verifyNoInteractions(events, cache);
  }

  @Test
  void drainsFullBatchesUntilAShortOne() {
    List<Message> full = ids(MessageSweepService.BATCH_SIZE, 0);
    when(mongo.find(any(Query.class), eq(Message.class))).thenReturn(full, full, ids(3, 5000));
    when(mongo.updateFirst(any(Query.class), any(UpdateDefinition.class), eq(Conversation.class)))
        .thenReturn(UpdateResult.acknowledged(1, 1L, null));

    sweep.sweep(conv(60, NOW.minusSeconds(3600)), NOW);

    verify(mongo, times(3)).remove(any(Query.class), eq(Message.class));
    verify(events).publishShared(CONV);
  }

  @Test
  void stopsAfterMaxBatchesPerRun() {
    when(mongo.find(any(Query.class), eq(Message.class)))
        .thenReturn(ids(MessageSweepService.BATCH_SIZE, 0));
    sweep.sweep(conv(60, NOW.minusSeconds(3600)), NOW);
    verify(mongo, times(20)).remove(any(Query.class), eq(Message.class));
  }

  @Test
  void scheduledRunStampsLegacyConversationsAndIsolatesFailures() {
    when(mongo.updateMulti(any(Query.class), any(UpdateDefinition.class), eq(Conversation.class)))
        .thenReturn(UpdateResult.acknowledged(2, 2L, null));
    Conversation broken =
        Conversation.builder()
            .id("broken")
            .autoDeleteSeconds(60)
            .autoDeleteEnabledAt(Instant.EPOCH)
            .build();
    Conversation ok =
        Conversation.builder()
            .id(CONV)
            .autoDeleteSeconds(60)
            .autoDeleteEnabledAt(Instant.EPOCH)
            .build();
    when(mongo.find(any(Query.class), eq(Conversation.class)))
        .thenReturn(new ArrayList<>(List.of(broken, ok)));
    when(mongo.find(any(Query.class), eq(Message.class)))
        .thenThrow(new RuntimeException("boom"))
        .thenReturn(List.of());

    sweep.sweepExpiredMessages();

    ArgumentCaptor<Query> legacy = ArgumentCaptor.forClass(Query.class);
    ArgumentCaptor<UpdateDefinition> stamp = ArgumentCaptor.forClass(UpdateDefinition.class);
    verify(mongo).updateMulti(legacy.capture(), stamp.capture(), eq(Conversation.class));
    assertThat(legacy.getValue().getQueryObject().get("autoDeleteEnabledAt"))
        .isEqualTo(new Document("$exists", false));
    assertThat(((Update) stamp.getValue()).getUpdateObject().get("$set", Document.class))
        .containsKey("autoDeleteEnabledAt");
    // The second conversation is still swept after the first one failed.
    verify(mongo, times(2)).find(any(Query.class), eq(Message.class));
  }
}
