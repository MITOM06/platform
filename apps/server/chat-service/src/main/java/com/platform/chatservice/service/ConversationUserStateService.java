package com.platform.chatservice.service;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.MessageRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Per-user conversation state — mute, archive, the "Blocked" section, read/unread, clear history
 * and hide (delete for me). None of it is shared with the other members: the controller sends the
 * resulting view to the actor only (see {@link ConversationEventPublisher#publishToUser}). Every
 * write is a single atomic update on the caller's own key / array entry, guarded by membership.
 */
@Service
@RequiredArgsConstructor
public class ConversationUserStateService {

  /** Sentinel value meaning "muted until the user manually unmutes". */
  static final long MUTE_FOREVER_MS = 9_200_000_000_000_000L;

  private final ConversationWriteSupport support;
  private final MessageRepository messageRepository;
  private final MongoTemplate mongoTemplate;

  /**
   * Mute conversation for userId with a time-based duration.
   *
   * @param durationSeconds 900=15min, 1800=30min, 3600=1h, 86400=24h, -1=forever
   */
  public ConversationResponse mute(String userId, String conversationId, long durationSeconds) {
    long expiryMs =
        (durationSeconds <= 0)
            ? MUTE_FOREVER_MS
            : System.currentTimeMillis() + durationSeconds * 1000L;
    return apply(
        userId,
        conversationId,
        new Update().set("mutedUntil." + ConversationWriteSupport.safeKey(userId), expiryMs));
  }

  public ConversationResponse unmute(String userId, String conversationId) {
    return apply(
        userId,
        conversationId,
        new Update().unset("mutedUntil." + ConversationWriteSupport.safeKey(userId)));
  }

  public ConversationResponse archive(String userId, String conversationId) {
    return apply(userId, conversationId, new Update().addToSet("archivedBy", userId));
  }

  public ConversationResponse unarchive(String userId, String conversationId) {
    return apply(userId, conversationId, new Update().pull("archivedBy", userId));
  }

  /** Move conversation to the Blocked section for userId (called after blockUser). */
  public ConversationResponse blockArchive(String userId, String conversationId) {
    return apply(userId, conversationId, new Update().addToSet("blockedBy", userId));
  }

  /** Restore conversation from Blocked section (called after unblockUser). */
  public ConversationResponse blockRestore(String userId, String conversationId) {
    return apply(userId, conversationId, new Update().pull("blockedBy", userId));
  }

  /** "Start over": hide all messages up to now for this user only. */
  public ConversationResponse clearHistory(String userId, String conversationId) {
    return apply(
        userId,
        conversationId,
        new Update().set("clearedAt." + ConversationWriteSupport.safeKey(userId), Instant.now()));
  }

  /** Hide the conversation from the user's list and clear their history cutoff. */
  public void deleteConversation(String userId, String conversationId) {
    support.updateAsParticipant(
        userId,
        conversationId,
        new Update()
            .addToSet("hiddenFor", userId)
            .set("clearedAt." + ConversationWriteSupport.safeKey(userId), Instant.now()));
  }

  public ConversationResponse markUnread(String userId, String conversationId) {
    Conversation conversation = support.requireParticipant(userId, conversationId);
    Page<Message> page =
        messageRepository.findByConversationIdOrderByCreatedAtDesc(
            conversationId, PageRequest.of(0, 1, Sort.by(Sort.Direction.DESC, "createdAt")));
    if (!page.isEmpty()) {
      // Atomic $pull mirrors markRead's $addToSet: avoids the read-modify-write race where a
      // concurrent read could silently re-add the user to readBy.
      mongoTemplate.updateFirst(
          new Query(Criteria.where("_id").is(page.getContent().get(0).getId())),
          new Update().pull("readBy", userId),
          Message.class);
    }
    return support.view(conversation, userId);
  }

  public ConversationResponse markRead(String userId, String conversationId) {
    Conversation conversation = support.requireParticipant(userId, conversationId);
    // Atomic per-document $addToSet avoids the read-modify-write race where a
    // message arriving mid-operation could be silently re-marked unread, and
    // avoids loading the whole unread set into memory.
    mongoTemplate.updateMulti(
        new Query(Criteria.where("conversationId").is(conversationId).and("readBy").nin(userId)),
        new Update().addToSet("readBy", userId),
        Message.class);
    return support.view(conversation, userId, 0L);
  }

  /** Atomic update guarded by membership (404 when the caller is not a participant). */
  private ConversationResponse apply(String userId, String conversationId, Update update) {
    return support.view(support.updateAsParticipant(userId, conversationId, update), userId);
  }
}
