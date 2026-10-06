package com.platform.chatservice.service;

import com.mongodb.client.result.UpdateResult;
import com.platform.chatservice.dto.AiTraceResponse;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.exception.MessageNotFoundException;
import com.platform.chatservice.model.AiTraceData;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.model.PendingAction;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Write-side of the message domain: sending, editing, recalling, forwarding and system-message
 * creation. Reactions, delete-for-me and pins live in {@link MessageInteractionService}; read/query
 * concerns in {@link MessageQueryService}; AI-message persistence in {@link AiMessageService}.
 */
@Service
@RequiredArgsConstructor
public class MessageService {

  private static final String SYSTEM_SENDER = "system";

  private final MessageRepository messageRepository;
  private final ConversationRepository conversationRepository;
  private final MongoTemplate mongoTemplate;
  private final MessageServiceHelper helper;
  private final MessageMapper messageMapper;
  private final AiMessageService aiMessageService;
  private final ConversationCacheService conversationCacheService;

  /**
   * Outcome of a recall / edit: the updated message, and whether it was the conversation's newest
   * message (so {@code lastMessage} was refreshed and the conversation lists must be told).
   */
  public record MessageChange(MessageResponse message, boolean previewChanged) {}

  public MessageResponse sendMessage(String senderId, SendMessageRequest request) {
    if (request.content() == null || request.content().trim().isEmpty()) {
      throw new IllegalArgumentException("Message content cannot be empty");
    }
    Conversation conversation =
        conversationRepository
            .findById(request.conversationId())
            .orElseThrow(() -> new ConversationNotFoundException(request.conversationId()));
    if (conversation.getParticipants() == null
        || !conversation.getParticipants().contains(senderId)) {
      throw new ConversationNotFoundException(request.conversationId());
    }
    String type = MessageTypePolicy.resolveClientType(request.type(), request.content());
    requireNotBlockedInDirect(conversation, senderId);

    Message.ReplyPreview replyPreview =
        helper.buildReplyPreview(request.replyToId(), conversation.getId());
    List<String> mentions =
        helper.parseMentions(request.content(), conversation.getParticipants(), senderId);

    Message message =
        messageRepository.save(
            Message.builder()
                .conversationId(request.conversationId())
                .senderId(senderId)
                .content(request.content())
                .type(type)
                .readBy(new ArrayList<>(List.of(senderId)))
                .replyToId(replyPreview == null ? null : request.replyToId())
                .replyPreview(replyPreview)
                .mentions(mentions)
                .build());

    Instant sentAt = message.getCreatedAt() != null ? message.getCreatedAt() : Instant.now();
    // Targeted atomic $set update instead of loading + saving the whole Conversation document:
    // avoids clobbering concurrent archive/mute/member changes and does not overwrite fields the
    // caller never intended to touch. The cache is evicted so the next read reloads fresh.
    Update update =
        new Update()
            .set("lastMessage", Conversation.LastMessage.of(message, sentAt))
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
   * Block User applies to DIRECT conversations only. It used to reject the send when ANY
   * participant had blocked the sender — so blocking someone silenced them in every group the two
   * happened to share.
   */
  private void requireNotBlockedInDirect(Conversation conversation, String senderId) {
    if (conversation.isGroup()) {
      return;
    }
    for (String participant : conversation.getParticipants()) {
      if (!participant.equals(senderId) && helper.isBlockedBetween(senderId, participant)) {
        throw new ForbiddenException(
            ErrorCodes.USER_BLOCKED, "Cannot send message: user is blocked");
      }
    }
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
    return createSystemMessage(conversationId, content, null);
  }

  /**
   * Persist a "system" notice attributed to {@code actorId} (its {@code senderId}; already read by
   * them) — e.g. {@code system.admin.promoted:<targetUserId>}, whose humanizer names the actor from
   * the sender and the target from the code. {@code actorId == null} = the anonymous {@code
   * "system"} sender.
   */
  public MessageResponse createSystemMessage(
      String conversationId, String content, String actorId) {
    boolean attributed = actorId != null && !actorId.isBlank();
    Message message =
        messageRepository.save(
            Message.builder()
                .conversationId(conversationId)
                .senderId(attributed ? actorId : SYSTEM_SENDER)
                .content(content)
                .type(MessageTypePolicy.SYSTEM)
                .readBy(attributed ? new ArrayList<>(List.of(actorId)) : new ArrayList<>())
                .build());
    Instant at = message.getCreatedAt() != null ? message.getCreatedAt() : Instant.now();
    bumpConversation(
        conversationId,
        new Update()
            .set("lastMessage", Conversation.LastMessage.of(message, at))
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
   * Recall (unsend) for everyone — only the original sender may do this. Atomic on the message;
   * also blanks the text quoted by replies to it and, when it was the newest message, the
   * conversation's {@code lastMessage} preview (marked {@code recalled}).
   */
  public MessageChange recallMessage(String userId, String messageId) {
    Message message =
        messageRepository
            .findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));
    if (!userId.equals(message.getSenderId())) {
      throw new ForbiddenException("Only the sender can recall this message");
    }
    Message updated =
        mongoTemplate.findAndModify(
            new Query(Criteria.where("_id").is(messageId).and("senderId").is(userId)),
            new Update()
                .set("recalled", true)
                .set("content", "")
                .set("reactions", new ArrayList<>())
                .unset("replyPreview"),
            FindAndModifyOptions.options().returnNew(true),
            Message.class);
    if (updated == null) {
      throw new MessageNotFoundException(messageId);
    }
    // Quotes of the recalled message must not keep its text.
    mongoTemplate.updateMulti(
        new Query(
            Criteria.where("conversationId")
                .is(message.getConversationId())
                .and("replyPreview.messageId")
                .is(messageId)),
        new Update().set("replyPreview.content", "").set("replyPreview.recalled", true),
        Message.class);
    boolean previewChanged =
        refreshPreviewIfLatest(
            message,
            new Update()
                .set("lastMessage.content", "")
                .set("lastMessage.recalled", true)
                .set("lastMessage.messageId", messageId));
    return new MessageChange(toResponse(updated), previewChanged);
  }

  /**
   * Edit a message's content — only the original sender may do this, only text messages (the only
   * kind either client offers to edit; editing e.g. a client-sent system notice would let its code
   * be rewritten), and never a recalled message. Stamps {@code editedAt}; refreshes the
   * conversation preview when the edited message is the newest.
   */
  public MessageChange editMessage(String userId, String messageId, String newContent) {
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
    String type = message.getType() == null ? MessageTypePolicy.TEXT : message.getType();
    if (!MessageTypePolicy.TEXT.equals(type)) {
      throw new BadRequestException(
          ErrorCodes.MESSAGE_TYPE_NOT_ALLOWED, "Only text messages can be edited");
    }
    String content = newContent.trim();
    MessageTypePolicy.resolveClientType(MessageTypePolicy.TEXT, content);
    Message updated =
        mongoTemplate.findAndModify(
            new Query(
                Criteria.where("_id")
                    .is(messageId)
                    .and("senderId")
                    .is(userId)
                    .and("recalled")
                    .ne(true)),
            new Update().set("content", content).set("editedAt", Instant.now()),
            FindAndModifyOptions.options().returnNew(true),
            Message.class);
    if (updated == null) {
      // Recalled (or deleted) between the read and the write.
      throw new IllegalArgumentException("Cannot edit a recalled message");
    }
    boolean previewChanged =
        refreshPreviewIfLatest(
            message,
            new Update()
                .set("lastMessage.content", content)
                .set("lastMessage.messageId", messageId));
    return new MessageChange(toResponse(updated), previewChanged);
  }

  /**
   * Conditionally apply {@code previewUpdate} to the conversation, only if its {@code lastMessage}
   * still mirrors {@code message} (by id; legacy previews without an id match on sender +
   * timestamp). Atomic — a newer message landing concurrently is never overwritten.
   */
  private boolean refreshPreviewIfLatest(Message message, Update previewUpdate) {
    List<Criteria> mirrors = new ArrayList<>();
    mirrors.add(Criteria.where("lastMessage.messageId").is(message.getId()));
    if (message.getCreatedAt() != null && message.getSenderId() != null) {
      mirrors.add(
          new Criteria()
              .andOperator(
                  Criteria.where("lastMessage.messageId").exists(false),
                  Criteria.where("lastMessage.senderId").is(message.getSenderId()),
                  Criteria.where("lastMessage.createdAt").is(message.getCreatedAt())));
    }
    Query query =
        new Query(
            new Criteria()
                .andOperator(
                    Criteria.where("_id").is(message.getConversationId()),
                    new Criteria().orOperator(mirrors.toArray(new Criteria[0]))));
    UpdateResult result = mongoTemplate.updateFirst(query, previewUpdate, Conversation.class);
    if (result == null || result.getModifiedCount() == 0) {
      return false;
    }
    conversationCacheService.evict(message.getConversationId());
    return true;
  }

  /**
   * Forward a message to a target conversation (Task 53). Creates a copy of the original content in
   * the target conversation as a new message from the forwarding user. Assistant replies are
   * forwarded as text; server-only kinds (system notices, call logs, meeting summaries) cannot be
   * forwarded.
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
    if (srcConv.getParticipants() == null || !srcConv.getParticipants().contains(userId)) {
      throw new ForbiddenException("Not a participant of source conversation");
    }
    String type = MessageTypePolicy.forwardedType(original.getType());
    return sendMessage(
        userId, new SendMessageRequest(targetConversationId, original.getContent(), type, null));
  }

  MessageResponse toResponse(Message m) {
    return messageMapper.toResponse(m);
  }

  /**
   * Save an AI-generated message (with optional trace) and broadcast it to the conversation topic.
   */
  public MessageResponse saveAiMessage(String conversationId, String content, AiTraceData trace) {
    return aiMessageService.saveAiMessage(conversationId, content, trace);
  }

  /** Persist an AI reply without broadcasting it (the caller delivers it in an ordered batch). */
  public MessageResponse persistAiMessage(
      String conversationId, String content, AiTraceData trace) {
    return aiMessageService.persistAiMessage(conversationId, content, trace);
  }

  /** Same, with the sensitive actions the reply waits for the requester to confirm (F2). */
  public MessageResponse persistAiMessage(
      String conversationId,
      String content,
      AiTraceData trace,
      List<PendingAction> pendingActions) {
    return aiMessageService.persistAiMessage(conversationId, content, trace, pendingActions);
  }

  /** Same, recording the ai-service stream {@code replyId} on the saved message. */
  public MessageResponse persistAiMessage(
      String conversationId,
      String content,
      AiTraceData trace,
      List<PendingAction> pendingActions,
      String aiReplyId) {
    return aiMessageService.persistAiMessage(
        conversationId, content, trace, pendingActions, aiReplyId);
  }

  /**
   * Returns the AI trace for a message. Throws 404 if message not found or trace is null (regular
   * non-AI messages have no trace).
   */
  public AiTraceResponse getMessageTrace(String userId, String messageId) {
    return aiMessageService.getMessageTrace(userId, messageId);
  }
}
