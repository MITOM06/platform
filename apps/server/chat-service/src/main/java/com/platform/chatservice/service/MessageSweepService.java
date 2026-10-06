package com.platform.chatservice.service;

import com.mongodb.client.result.UpdateResult;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Background sweep for disappearing messages.
 *
 * <p>Only messages created at/after the conversation's {@code autoDeleteEnabledAt} and older than
 * its window are deleted. The sweep used to delete EVERY message older than the window, so the
 * moment anyone switched the setting on, the whole history disappeared for everyone. Conversations
 * that were enabled before {@code autoDeleteEnabledAt} existed get it stamped to "now" on the next
 * sweep — their remaining history is kept.
 *
 * <p>After a sweep removes messages: quotes of them lose their text, and — only if the preview
 * still points at a swept message — {@code lastMessage}/{@code lastMessageAt} are refreshed from
 * the newest remaining message with one conditional atomic update (never a whole-document save that
 * could clobber a concurrent write), followed by a shared {@code CONVERSATION_UPDATED}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MessageSweepService {

  /** Messages deleted per round trip; a conversation is drained in at most MAX_BATCHES rounds. */
  static final int BATCH_SIZE = 1_000;

  private static final int MAX_BATCHES = 20;

  private final MongoTemplate mongoTemplate;
  private final ConversationCacheService conversationCacheService;
  private final ConversationEventPublisher events;

  /** Background sweep removing messages past each conversation's disappearing-messages window. */
  @Scheduled(fixedDelayString = "${app.auto-delete.sweep-interval-ms:300000}")
  public void sweepExpiredMessages() {
    Instant now = Instant.now();
    stampLegacyConversations(now);
    List<Conversation> conversations =
        mongoTemplate.find(
            new Query(
                Criteria.where("autoDeleteSeconds").gt(0).and("autoDeleteEnabledAt").exists(true)),
            Conversation.class);
    for (Conversation conversation : conversations) {
      try {
        sweep(conversation, now);
      } catch (RuntimeException e) {
        log.error("Disappearing-message sweep failed for {}", conversation.getId(), e);
      }
    }
  }

  /** Enabled before the field existed: start the clock now instead of deleting the history. */
  private void stampLegacyConversations(Instant now) {
    UpdateResult result =
        mongoTemplate.updateMulti(
            new Query(
                Criteria.where("autoDeleteSeconds").gt(0).and("autoDeleteEnabledAt").exists(false)),
            new Update().set("autoDeleteEnabledAt", now),
            Conversation.class);
    if (result != null && result.getModifiedCount() > 0) {
      log.info(
          "Stamped autoDeleteEnabledAt on {} legacy disappearing-message conversation(s)",
          result.getModifiedCount());
    }
  }

  void sweep(Conversation conversation, Instant now) {
    Integer seconds = conversation.getAutoDeleteSeconds();
    Instant enabledAt = conversation.getAutoDeleteEnabledAt();
    if (seconds == null || seconds <= 0 || enabledAt == null) return;
    Instant cutoff = now.minusSeconds(seconds);
    if (!cutoff.isAfter(enabledAt)) return; // nothing created since enabling is old enough yet

    String conversationId = conversation.getId();
    long removed = 0;
    for (int batch = 0; batch < MAX_BATCHES; batch++) {
      Query expired =
          new Query(
                  Criteria.where("conversationId")
                      .is(conversationId)
                      .and("createdAt")
                      .gte(enabledAt)
                      .lt(cutoff))
              .limit(BATCH_SIZE);
      expired.fields().include("_id");
      List<String> ids =
          mongoTemplate.find(expired, Message.class).stream().map(Message::getId).toList();
      if (ids.isEmpty()) break;
      mongoTemplate.remove(new Query(Criteria.where("_id").in(ids)), Message.class);
      // A reply must not keep quoting the text of a message that has disappeared.
      mongoTemplate.updateMulti(
          new Query(
              Criteria.where("conversationId")
                  .is(conversationId)
                  .and("replyPreview.messageId")
                  .in(ids)),
          new Update().set("replyPreview.content", ""),
          Message.class);
      removed += ids.size();
      if (ids.size() < BATCH_SIZE) break;
    }
    if (removed == 0) return;
    if (refreshLastMessage(conversationId, cutoff)) {
      events.publishShared(conversationId);
    }
  }

  /**
   * Recompute {@code lastMessage}/{@code lastMessageAt} from the newest remaining message — only if
   * the current preview is older than {@code cutoff} (i.e. it mirrored a swept message). A message
   * that arrived meanwhile has a newer {@code lastMessageAt}, so the guard never overwrites it.
   */
  private boolean refreshLastMessage(String conversationId, Instant cutoff) {
    Query latestQuery =
        new Query(Criteria.where("conversationId").is(conversationId))
            .with(
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "_id")))
            .limit(1);
    Message latest = mongoTemplate.findOne(latestQuery, Message.class);
    Update update =
        latest == null
            ? new Update().unset("lastMessage").unset("lastMessageAt")
            : new Update()
                .set("lastMessage", Conversation.LastMessage.of(latest, latest.getCreatedAt()))
                .set("lastMessageAt", latest.getCreatedAt());
    Query guarded =
        new Query(
            new Criteria()
                .andOperator(
                    Criteria.where("_id").is(conversationId),
                    new Criteria()
                        .orOperator(
                            Criteria.where("lastMessageAt").lt(cutoff),
                            Criteria.where("lastMessageAt").exists(false))));
    UpdateResult result = mongoTemplate.updateFirst(guarded, update, Conversation.class);
    conversationCacheService.evict(conversationId);
    return result != null && result.getModifiedCount() > 0;
  }
}
