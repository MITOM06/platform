package com.platform.chatservice.service;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PinResult;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.exception.MessageNotFoundException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationUpdate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Per-message interactions: reactions, delete-for-me and pin/unpin. Every write is a single atomic
 * Mongo update — the previous load → modify → {@code save()} of the whole document (no
 * {@code @Version}) let two concurrent writers revert each other (a reaction undone by a
 * simultaneous delete-for-me, a pin lost to a concurrent unpin, …).
 */
@Service
@RequiredArgsConstructor
public class MessageInteractionService {

  /** Max pinned messages per conversation, newest first. A pin past it is refused (409). */
  public static final int MAX_PINNED_MESSAGES = 5;

  /** System-message content codes for pin/unpin notices (see THE PIN SYSTEM-MESSAGE CONTRACT). */
  private static final String SYS_PINNED_PREFIX = "system.message.pinned:";

  private static final String SYS_UNPINNED_PREFIX = "system.message.unpinned:";

  /** Generous for any emoji sequence (ZWJ families, skin tones, flags) — not for payloads. */
  private static final int MAX_REACTION_LENGTH = 32;

  private static final FindAndModifyOptions RETURN_NEW =
      FindAndModifyOptions.options().returnNew(true);

  private final MessageRepository messageRepository;
  private final ConversationRepository conversationRepository;
  private final MongoTemplate mongoTemplate;
  private final MessageServiceHelper helper;
  private final MessageMapper messageMapper;
  private final MessageService messageService;
  private final ConversationCacheService conversationCacheService;

  /**
   * One reaction per user (Messenger-style): the new emoji replaces the user's existing one in
   * place, otherwise it is appended. Both steps are conditional single-document updates, so two
   * concurrent reactions never produce duplicates or drop someone else's reaction.
   */
  public MessageResponse addReaction(String userId, String messageId, String emoji) {
    String value = emoji == null ? "" : emoji.trim();
    if (value.isEmpty() || value.length() > MAX_REACTION_LENGTH) {
      throw new BadRequestException("Invalid reaction");
    }
    helper.requireParticipantMessage(userId, messageId);
    for (int attempt = 0; attempt < 3; attempt++) {
      Message updated =
          mongoTemplate.findAndModify(
              new Query(Criteria.where("_id").is(messageId).and("reactions.userId").is(userId)),
              new Update().set("reactions.$.emoji", value),
              RETURN_NEW,
              Message.class);
      if (updated == null) {
        updated =
            mongoTemplate.findAndModify(
                new Query(Criteria.where("_id").is(messageId).and("reactions.userId").ne(userId)),
                new Update()
                    .push(
                        "reactions",
                        Message.Reaction.builder().userId(userId).emoji(value).build()),
                RETURN_NEW,
                Message.class);
      }
      if (updated != null) {
        return messageMapper.toResponse(updated);
      }
      // A concurrent request of the same user won the race between the two steps — re-run.
    }
    return messageMapper.toResponse(reload(messageId));
  }

  public MessageResponse removeReaction(String userId, String messageId) {
    helper.requireParticipantMessage(userId, messageId);
    Message updated =
        mongoTemplate.findAndModify(
            new Query(Criteria.where("_id").is(messageId)),
            new Update().pull("reactions", new Document("userId", userId)),
            RETURN_NEW,
            Message.class);
    return messageMapper.toResponse(updated != null ? updated : reload(messageId));
  }

  /** Hide a message for the requesting user only. Caller must be a conversation participant. */
  public void deleteForMe(String userId, String messageId) {
    helper.requireParticipantMessage(userId, messageId);
    mongoTemplate.updateFirst(
        new Query(Criteria.where("_id").is(messageId)),
        new Update().addToSet("deletedFor", userId),
        Message.class);
  }

  /**
   * Pin a message in its conversation (Task 53). Any participant may pin in a direct chat; group
   * chats require admin rights. At most {@link #MAX_PINNED_MESSAGES} pins, newest first: pinning a
   * new message when the limit is reached answers {@code 409 PIN_LIMIT_REACHED} ({@code
   * params.max}) — the oldest pin is never evicted silently. Re-pinning an already pinned message
   * just moves it to the front. The limit check and the write are one atomic update.
   */
  public PinResult pinMessage(String userId, String messageId) {
    Message message = loadMessage(messageId);
    Conversation conversation = loadConversation(message.getConversationId());
    requireParticipant(conversation, userId);
    if (message.isRecalled()) {
      throw new IllegalArgumentException("Cannot pin a recalled message");
    }
    if ("call_log".equals(message.getType())) {
      throw new IllegalArgumentException("Cannot pin a call message");
    }
    if (MessageTypePolicy.SYSTEM.equals(message.getType())) {
      throw new IllegalArgumentException("Cannot pin a system message");
    }
    requireAdminInGroup(conversation, userId, "Only admins can pin messages in a group");
    // Already pinned (re-pin = move to front) OR still below the limit ("pinnedMessages.<MAX-1>"
    // absent ⇔ fewer than MAX entries) — evaluated atomically with the write.
    Criteria roomForPin =
        new Criteria()
            .orOperator(
                Criteria.where("pinnedMessages").is(messageId),
                Criteria.where("pinnedMessages." + (MAX_PINNED_MESSAGES - 1)).exists(false));
    Conversation updated =
        mongoTemplate.findAndModify(
            new Query(
                new Criteria()
                    .andOperator(Criteria.where("_id").is(conversation.getId()), roomForPin)),
            pinFirst(messageId),
            RETURN_NEW,
            Conversation.class);
    conversationCacheService.evict(conversation.getId());
    if (updated == null) {
      if (!mongoTemplate.exists(
          new Query(Criteria.where("_id").is(conversation.getId())), Conversation.class)) {
        throw new ConversationNotFoundException(conversation.getId());
      }
      throw new ApiException(
          HttpStatus.CONFLICT,
          ErrorCodes.PIN_LIMIT_REACHED,
          "At most " + MAX_PINNED_MESSAGES + " messages can be pinned",
          Map.of("max", MAX_PINNED_MESSAGES));
    }
    List<String> pinned = pinnedOf(updated);
    // Persisted centered notice.
    MessageResponse systemMessage =
        messageService.createSystemMessage(conversation.getId(), SYS_PINNED_PREFIX + userId);
    return new PinResult(conversation.getId(), pinned, systemMessage);
  }

  /** Unpin a message. Same permission rules as pinMessage. */
  public PinResult unpinMessage(String userId, String messageId) {
    Message message = loadMessage(messageId);
    Conversation conversation = loadConversation(message.getConversationId());
    requireParticipant(conversation, userId);
    requireAdminInGroup(conversation, userId, "Only admins can unpin messages in a group");
    Conversation updated =
        mongoTemplate.findAndModify(
            new Query(Criteria.where("_id").is(conversation.getId())),
            new Update().pull("pinnedMessages", messageId),
            RETURN_NEW,
            Conversation.class);
    conversationCacheService.evict(conversation.getId());
    MessageResponse systemMessage =
        messageService.createSystemMessage(conversation.getId(), SYS_UNPINNED_PREFIX + userId);
    return new PinResult(conversation.getId(), pinnedOf(updated), systemMessage);
  }

  /**
   * Pipeline update: {@code pinnedMessages = [id] + (pinnedMessages - id)} in one atomic write (a
   * {@code $pull} + {@code $push} pair cannot target the same field in one update). No {@code
   * $slice}: the caller's query guarantees there is room, so nothing is ever dropped.
   */
  private static AggregationUpdate pinFirst(String messageId) {
    Document others =
        new Document(
            "$filter",
            new Document("input", new Document("$ifNull", List.of("$pinnedMessages", List.of())))
                .append("cond", new Document("$ne", List.of("$$this", messageId))));
    Document pinned =
        new Document(
            "$concatArrays", List.of(new Document("$literal", List.of(messageId)), others));
    AggregationOperation stage =
        context -> new Document("$set", new Document("pinnedMessages", pinned));
    return AggregationUpdate.from(List.of(stage));
  }

  private static List<String> pinnedOf(Conversation conversation) {
    if (conversation == null || conversation.getPinnedMessages() == null) {
      return List.of();
    }
    return conversation.getPinnedMessages();
  }

  private Message loadMessage(String messageId) {
    return messageRepository
        .findById(messageId)
        .orElseThrow(() -> new MessageNotFoundException(messageId));
  }

  private Message reload(String messageId) {
    return loadMessage(messageId);
  }

  private Conversation loadConversation(String conversationId) {
    return conversationRepository
        .findById(conversationId)
        .orElseThrow(() -> new ConversationNotFoundException(conversationId));
  }

  private static void requireParticipant(Conversation conversation, String userId) {
    if (conversation.getParticipants() == null
        || !conversation.getParticipants().contains(userId)) {
      throw new ForbiddenException("Not a participant of this conversation");
    }
  }

  private static void requireAdminInGroup(
      Conversation conversation, String userId, String message) {
    if (conversation.isGroup()
        && (conversation.getAdmins() == null || !conversation.getAdmins().contains(userId))) {
      throw new ForbiddenException(ErrorCodes.GROUP_ADMIN_REQUIRED, message);
    }
  }
}
