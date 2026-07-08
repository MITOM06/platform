package com.platform.chatservice.service;

import com.platform.chatservice.dto.AiTraceResponse;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PinResult;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.exception.MessageNotFoundException;
import com.platform.chatservice.model.AiTraceData;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Write-side of the message domain: sending, editing, recalling, reactions, pin/unpin, forwarding
 * and system-message creation. Read/query concerns (pagination, search, AI history) live in {@link
 * MessageQueryService}; AI-message persistence lives in {@link AiMessageService}.
 */
@Service
@RequiredArgsConstructor
public class MessageService {

  private static final String SYSTEM_SENDER = "system";

  /** Max pinned messages per conversation (matches Conversation model comment). */
  static final int MAX_PINNED_MESSAGES = 2;

  /** System-message content codes for pin/unpin notices (see THE PIN SYSTEM-MESSAGE CONTRACT). */
  private static final String SYS_PINNED_PREFIX = "system.message.pinned:";

  private static final String SYS_UNPINNED_PREFIX = "system.message.unpinned:";

  private final MessageRepository messageRepository;
  private final ConversationRepository conversationRepository;
  private final MongoTemplate mongoTemplate;
  private final MessageServiceHelper helper;
  private final MessageMapper messageMapper;
  private final AiMessageService aiMessageService;
  private final ConversationCacheService conversationCacheService;

  public MessageResponse sendMessage(String senderId, SendMessageRequest request) {
    if (request.content() == null || request.content().trim().isEmpty()) {
      throw new IllegalArgumentException("Message content cannot be empty");
    }
    Conversation conversation =
        conversationRepository
            .findById(request.conversationId())
            .orElseThrow(() -> new ConversationNotFoundException(request.conversationId()));
    if (!conversation.getParticipants().contains(senderId)) {
      throw new ConversationNotFoundException(request.conversationId());
    }
    // Block User: reject if the sender blocked, or is blocked by, any other
    // participant of the conversation (covers both directions).
    for (String participant : conversation.getParticipants()) {
      if (!participant.equals(senderId) && helper.isBlockedBetween(senderId, participant)) {
        throw new ForbiddenException("Cannot send message: user is blocked");
      }
    }

    Message.ReplyPreview replyPreview = helper.buildReplyPreview(request.replyToId());
    List<String> mentions =
        helper.parseMentions(request.content(), conversation.getParticipants(), senderId);

    Message message =
        messageRepository.save(
            Message.builder()
                .conversationId(request.conversationId())
                .senderId(senderId)
                .content(request.content())
                .type(request.type() != null ? request.type() : "text")
                .readBy(new ArrayList<>(List.of(senderId)))
                .replyToId(request.replyToId())
                .replyPreview(replyPreview)
                .mentions(mentions)
                .build());

    Instant sentAt = message.getCreatedAt() != null ? message.getCreatedAt() : Instant.now();
    // Targeted atomic $set update instead of loading + saving the whole Conversation document:
    // avoids clobbering concurrent archive/mute/member changes and does not overwrite fields the
    // caller never intended to touch. The cache is evicted so the next read reloads fresh.
    Update update =
        new Update()
            .set(
                "lastMessage",
                Conversation.LastMessage.builder()
                    .content(message.getContent())
                    .senderId(senderId)
                    .createdAt(sentAt)
                    .build())
            .set("lastMessageAt", sentAt)
            // A new message un-hides the conversation for everyone who had deleted it.
            .set("hiddenFor", new ArrayList<String>());
    // A reply from the recipient of a stranger request accepts it.
    if (Conversation.STATUS_PENDING.equals(conversation.getStatus())
        && !senderId.equals(conversation.getCreatedBy())) {
      update.set("status", Conversation.STATUS_ACCEPTED);
    }
    bumpConversation(request.conversationId(), update);

    return toResponse(message);
  }

  /**
   * Apply a targeted atomic update to a conversation and evict it from the cache. Used for
   * lastMessage/lastMessageAt bumps (and related single-field flips) so we never do a
   * load-then-save of the whole document that would clobber concurrent writes or leave the
   * {@code @CachePut} cache serving stale data.
   */
  void bumpConversation(String conversationId, Update update) {
    mongoTemplate.updateFirst(
        new Query(Criteria.where("_id").is(conversationId)), update, Conversation.class);
    conversationCacheService.evict(conversationId);
  }

  /** Persist a "system" message (e.g. group events) and bump the conversation. */
  public MessageResponse createSystemMessage(String conversationId, String content) {
    Message message =
        messageRepository.save(
            Message.builder()
                .conversationId(conversationId)
                .senderId(SYSTEM_SENDER)
                .content(content)
                .type("system")
                .readBy(new ArrayList<>())
                .build());
    Instant at = message.getCreatedAt() != null ? message.getCreatedAt() : Instant.now();
    bumpConversation(
        conversationId,
        new Update()
            .set(
                "lastMessage",
                Conversation.LastMessage.builder()
                    .content(content)
                    .senderId(SYSTEM_SENDER)
                    .createdAt(at)
                    .build())
            .set("lastMessageAt", at));
    return toResponse(message);
  }

  /**
   * Mark a message read for the given user. Enforces that the caller is a participant of the
   * message's conversation (throws otherwise), then atomically adds them to {@code readBy}. Returns
   * the message's actual conversationId so callers can validate a client-supplied conversationId
   * before broadcasting a MESSAGE_READ event.
   */
  public String markAsRead(String userId, String messageId) {
    Message message = helper.requireParticipantMessage(userId, messageId);
    Query query = new Query(Criteria.where("id").is(messageId));
    Update update = new Update().addToSet("readBy", userId);
    mongoTemplate.updateFirst(query, update, Message.class);
    return message.getConversationId();
  }

  /**
   * Toggle a single reaction per user (Messenger-style): the new emoji replaces any existing
   * reaction from the same user.
   */
  public MessageResponse addReaction(String userId, String messageId, String emoji) {
    Message message = helper.requireParticipantMessage(userId, messageId);
    List<Message.Reaction> reactions =
        message.getReactions() == null
            ? new ArrayList<>()
            : new ArrayList<>(message.getReactions());
    reactions.removeIf(r -> userId.equals(r.getUserId()));
    reactions.add(Message.Reaction.builder().userId(userId).emoji(emoji).build());
    message.setReactions(reactions);
    return toResponse(messageRepository.save(message));
  }

  public MessageResponse removeReaction(String userId, String messageId) {
    Message message = helper.requireParticipantMessage(userId, messageId);
    if (message.getReactions() != null) {
      List<Message.Reaction> reactions = new ArrayList<>(message.getReactions());
      reactions.removeIf(r -> userId.equals(r.getUserId()));
      message.setReactions(reactions);
      messageRepository.save(message);
    }
    return toResponse(message);
  }

  /** Recall (unsend) for everyone — only the original sender may do this. */
  public MessageResponse recallMessage(String userId, String messageId) {
    Message message =
        messageRepository
            .findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));
    if (!userId.equals(message.getSenderId())) {
      throw new ForbiddenException("Only the sender can recall this message");
    }
    message.setRecalled(true);
    message.setContent("");
    message.setReactions(new ArrayList<>());
    message.setReplyPreview(null);
    return toResponse(messageRepository.save(message));
  }

  /**
   * Edit a message's content — only the original sender may do this, and recalled messages cannot
   * be edited. Stamps {@code editedAt}.
   */
  public MessageResponse editMessage(String userId, String messageId, String newContent) {
    if (newContent == null || newContent.trim().isEmpty()) {
      throw new IllegalArgumentException("Message content cannot be empty");
    }
    Message message =
        messageRepository
            .findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));
    if (!userId.equals(message.getSenderId())) {
      throw new ForbiddenException("Only the sender can edit this message");
    }
    if (message.isRecalled()) {
      throw new IllegalArgumentException("Cannot edit a recalled message");
    }
    message.setContent(newContent.trim());
    message.setEditedAt(Instant.now());
    return toResponse(messageRepository.save(message));
  }

  /** Hide a message for the requesting user only. Caller must be a conversation participant. */
  public void deleteForMe(String userId, String messageId) {
    Message message = helper.requireParticipantMessage(userId, messageId);
    List<String> deletedFor =
        message.getDeletedFor() == null
            ? new ArrayList<>()
            : new ArrayList<>(message.getDeletedFor());
    if (!deletedFor.contains(userId)) {
      deletedFor.add(userId);
      message.setDeletedFor(deletedFor);
      messageRepository.save(message);
    }
  }

  /**
   * Pin a message in its conversation (Task 53). Any participant may pin in a direct chat; group
   * chats require admin rights. Keeps at most 5 pins, newest first. Returns the updated
   * conversation so the client can refresh the pinned-message header.
   */
  public PinResult pinMessage(String userId, String messageId) {
    Message message =
        messageRepository
            .findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));
    Conversation conversation =
        conversationRepository
            .findById(message.getConversationId())
            .orElseThrow(() -> new ConversationNotFoundException(message.getConversationId()));
    if (!conversation.getParticipants().contains(userId)) {
      throw new ForbiddenException("Not a participant of this conversation");
    }
    if (message.isRecalled()) {
      throw new IllegalArgumentException("Cannot pin a recalled message");
    }
    if ("call_log".equals(message.getType())) {
      throw new IllegalArgumentException("Cannot pin a call message");
    }
    if ("system".equals(message.getType())) {
      throw new IllegalArgumentException("Cannot pin a system message");
    }
    if (conversation.isGroup()) {
      boolean isAdmin =
          conversation.getAdmins() != null && conversation.getAdmins().contains(userId);
      if (!isAdmin) {
        throw new ForbiddenException("Only admins can pin messages in a group");
      }
    }
    List<String> pinned =
        conversation.getPinnedMessages() == null
            ? new ArrayList<>()
            : new ArrayList<>(conversation.getPinnedMessages());
    pinned.remove(messageId);
    pinned.add(0, messageId);
    if (pinned.size() > MAX_PINNED_MESSAGES) {
      pinned = pinned.subList(0, MAX_PINNED_MESSAGES);
    }
    conversation.setPinnedMessages(pinned);
    conversationRepository.save(conversation);
    // Persisted centered notice; eviction of an older pin emits NO extra "unpinned" message.
    MessageResponse systemMessage =
        createSystemMessage(conversation.getId(), SYS_PINNED_PREFIX + userId);
    return new PinResult(conversation.getId(), pinned, systemMessage);
  }

  /** Unpin a message. Same permission rules as pinMessage. */
  public PinResult unpinMessage(String userId, String messageId) {
    Message message =
        messageRepository
            .findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));
    Conversation conversation =
        conversationRepository
            .findById(message.getConversationId())
            .orElseThrow(() -> new ConversationNotFoundException(message.getConversationId()));
    if (!conversation.getParticipants().contains(userId)) {
      throw new ForbiddenException("Not a participant of this conversation");
    }
    if (conversation.isGroup()) {
      boolean isAdmin =
          conversation.getAdmins() != null && conversation.getAdmins().contains(userId);
      if (!isAdmin) {
        throw new ForbiddenException("Only admins can unpin messages in a group");
      }
    }
    List<String> pinned =
        conversation.getPinnedMessages() == null
            ? new ArrayList<>()
            : new ArrayList<>(conversation.getPinnedMessages());
    pinned.remove(messageId);
    conversation.setPinnedMessages(pinned);
    conversationRepository.save(conversation);
    MessageResponse systemMessage =
        createSystemMessage(conversation.getId(), SYS_UNPINNED_PREFIX + userId);
    return new PinResult(conversation.getId(), pinned, systemMessage);
  }

  /**
   * Forward a message to a target conversation (Task 53). Creates a copy of the original content in
   * the target conversation as a new message from the forwarding user.
   */
  public MessageResponse forwardMessage(
      String userId, String messageId, String targetConversationId) {
    Message original =
        messageRepository
            .findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));
    if (original.isRecalled()) {
      throw new IllegalArgumentException("Cannot forward a recalled message");
    }
    Conversation srcConv =
        conversationRepository
            .findById(original.getConversationId())
            .orElseThrow(() -> new ConversationNotFoundException(original.getConversationId()));
    if (!srcConv.getParticipants().contains(userId)) {
      throw new ForbiddenException("Not a participant of source conversation");
    }
    return sendMessage(
        userId,
        new SendMessageRequest(
            targetConversationId, original.getContent(), original.getType(), null));
  }

  MessageResponse toResponse(Message m) {
    return messageMapper.toResponse(m);
  }

  /**
   * Save an AI-generated message (with optional trace) and broadcast it to the conversation topic.
   * Called by AiResponseListener when AI_STREAM_DONE is received from Redis.
   */
  public MessageResponse saveAiMessage(String conversationId, String content, AiTraceData trace) {
    return aiMessageService.saveAiMessage(conversationId, content, trace);
  }

  /**
   * Returns the AI trace for a message. Throws 404 if message not found or trace is null (regular
   * non-AI messages have no trace).
   */
  public AiTraceResponse getMessageTrace(String userId, String messageId) {
    return aiMessageService.getMessageTrace(userId, messageId);
  }
}
