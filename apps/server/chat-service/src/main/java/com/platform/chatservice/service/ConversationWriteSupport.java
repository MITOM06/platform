package com.platform.chatservice.service;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.UpdateDefinition;
import org.springframework.stereotype.Component;

/**
 * Shared plumbing of the conversation write services: participant / admin checks, and atomic {@code
 * findAndModify} updates that keep the conversation cache consistent.
 *
 * <p>Every conversation mutation is a targeted Mongo update ({@code $set} / {@code $unset} / {@code
 * $addToSet} / {@code $pull}) instead of load → modify → {@code save()}: the document has no
 * {@code @Version}, so two concurrent whole-document saves (e.g. one member muting while an admin
 * adds members) silently reverted each other.
 */
@Component
@RequiredArgsConstructor
class ConversationWriteSupport {

  private static final FindAndModifyOptions RETURN_NEW =
      FindAndModifyOptions.options().returnNew(true);

  private final ConversationCacheService conversationCacheService;
  private final MongoTemplate mongoTemplate;
  private final MessageRepository messageRepository;
  private final ConversationMapper conversationMapper;

  /** Fetch a conversation, enforcing the caller is a participant (404 otherwise). */
  Conversation requireParticipant(String userId, String conversationId) {
    Conversation conversation =
        conversationCacheService
            .findByIdOptional(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
    if (conversation.getParticipants() == null
        || !conversation.getParticipants().contains(userId)) {
      throw new ConversationNotFoundException(conversationId);
    }
    return conversation;
  }

  /** Participant of a GROUP who is also one of its admins (403 GROUP_ADMIN_REQUIRED otherwise). */
  Conversation requireGroupAdmin(String userId, String conversationId) {
    Conversation conversation = requireParticipant(userId, conversationId);
    if (!conversation.isGroup()) {
      throw new IllegalArgumentException("Not a group conversation");
    }
    if (!isAdmin(conversation, userId)) {
      throw adminRequired("Only admins can perform this action");
    }
    return conversation;
  }

  static boolean isAdmin(Conversation conversation, String userId) {
    return conversation.getAdmins() != null && conversation.getAdmins().contains(userId);
  }

  static ForbiddenException adminRequired(String message) {
    return new ForbiddenException(ErrorCodes.GROUP_ADMIN_REQUIRED, message);
  }

  /**
   * Atomically apply {@code update} to the conversation (optionally guarded by {@code condition})
   * and return the updated document, or null when nothing matched. Always evicts the cache entry.
   */
  Conversation update(String conversationId, Criteria condition, UpdateDefinition update) {
    Criteria criteria = Criteria.where("_id").is(conversationId);
    Query query =
        condition == null
            ? new Query(criteria)
            : new Query(new Criteria().andOperator(criteria, condition));
    Conversation updated =
        mongoTemplate.findAndModify(query, update, RETURN_NEW, Conversation.class);
    conversationCacheService.evict(conversationId);
    return updated;
  }

  /** Same as {@link #update} but a no-match is "not a participant (any more)" → 404. */
  Conversation updateAsParticipant(String userId, String conversationId, UpdateDefinition update) {
    Conversation updated =
        update(conversationId, Criteria.where("participants").is(userId), update);
    if (updated == null) {
      throw new ConversationNotFoundException(conversationId);
    }
    return updated;
  }

  /**
   * {@code userId} is used as a map key in dotted update paths ({@code mutedUntil.<id>}, {@code
   * clearedAt.<id>}); a key with a dot or a leading {@code $} would address another field.
   */
  static String safeKey(String userId) {
    if (userId == null || userId.isEmpty() || userId.indexOf('.') >= 0 || userId.startsWith("$")) {
      throw new IllegalArgumentException("Invalid user id");
    }
    return userId;
  }

  ConversationResponse view(Conversation conversation, String userId) {
    return conversationMapper.toResponse(
        conversation, userId, messageRepository.countUnread(conversation.getId(), userId));
  }

  ConversationResponse view(Conversation conversation, String userId, long unreadCount) {
    return conversationMapper.toResponse(conversation, userId, unreadCount);
  }
}
