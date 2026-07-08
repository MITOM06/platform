package com.platform.chatservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.dto.AiHistoryEntry;
import com.platform.chatservice.dto.AiTraceResponse;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
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
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

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

  /**
   * Cursor-based pagination (newest first). When {@code beforeId} is null/blank the most recent
   * page is returned; otherwise only messages strictly older than that message are returned. This
   * keeps the scroll stable and avoids the duplication/jumping that offset paging suffers when new
   * messages arrive.
   *
   * <p>We over-fetch one row ({@code size + 1}) to detect whether more history exists, then encode
   * that into {@link PageResponse#hasNext()} via a synthetic {@code totalElements}.
   */
  public PageResponse<MessageResponse> getMessages(
      String userId, String conversationId, String beforeId, int size) {
    Conversation conversation =
        conversationRepository
            .findById(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
    if (!conversation.getParticipants().contains(userId)) {
      throw new ConversationNotFoundException(conversationId);
    }
    Instant clearedAt =
        conversation.getClearedAt() == null ? null : conversation.getClearedAt().get(userId);

    int pageSize = size <= 0 ? 20 : size;

    // Visibility filtering (deletedFor / clearedAt) is applied in the Mongo query itself, so the
    // over-fetched (pageSize + 1) rows are already the rows this user can actually see — this keeps
    // hasMore accurate and pages full (fixes the previous "filter after slice" under-fill bug).
    List<Message> rows =
        queryMessagePage(conversationId, userId, clearedAt, beforeId, pageSize + 1);

    boolean hasMore = rows.size() > pageSize;
    List<Message> pageRows = hasMore ? rows.subList(0, pageSize) : rows;
    List<MessageResponse> content = pageRows.stream().map(this::toResponse).toList();

    // page=0 always; totalElements is synthetic so hasNext() reflects `hasMore`.
    long total = hasMore ? (long) pageSize + 1 : content.size();
    return new PageResponse<>(content, 0, pageSize, total);
  }

  /**
   * Build one page of visible messages, newest first, with a stable compound cursor.
   *
   * <p>The cursor is a compound {@code (createdAt, _id)} tiebreaker so messages sharing the same
   * millisecond are never skipped: we return rows where {@code createdAt < cursor.createdAt} OR
   * ({@code createdAt == cursor.createdAt} AND {@code _id < cursor._id}), ordered by {@code
   * createdAt} desc then {@code _id} desc. Visibility filters ({@code deletedFor != userId}, and
   * {@code createdAt > clearedAt} when the user has a clear cutoff) are pushed into the query.
   */
  private List<Message> queryMessagePage(
      String conversationId, String userId, Instant clearedAt, String beforeId, int limit) {
    List<Criteria> ands = new ArrayList<>();
    ands.add(Criteria.where("conversationId").is(conversationId));
    ands.add(Criteria.where("deletedFor").ne(userId));
    if (clearedAt != null) {
      ands.add(Criteria.where("createdAt").gt(clearedAt));
    }

    if (beforeId != null && !beforeId.isBlank()) {
      Message cursor = messageRepository.findById(beforeId).orElse(null);
      if (cursor == null || cursor.getCreatedAt() == null) {
        // Unknown/incomplete cursor — return an empty page rather than the whole history.
        return List.of();
      }
      Instant cursorAt = cursor.getCreatedAt();
      // _id compares by its stored BSON type: ObjectId in prod (24-hex ids), String otherwise.
      Object cursorId = ObjectId.isValid(beforeId) ? new ObjectId(beforeId) : beforeId;
      ands.add(
          new Criteria()
              .orOperator(
                  Criteria.where("createdAt").lt(cursorAt),
                  new Criteria()
                      .andOperator(
                          Criteria.where("createdAt").is(cursorAt),
                          Criteria.where("_id").lt(cursorId))));
    }

    Query query =
        new Query(new Criteria().andOperator(ands.toArray(new Criteria[0])))
            .with(
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "_id")))
            .limit(limit);
    return mongoTemplate.find(query, Message.class);
  }

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
   * Catch-up fetch for Task 55 — returns messages with createdAt > afterTimestamp, oldest first,
   * capped at 50. Called on STOMP reconnect so the client can sync any messages that arrived while
   * it was offline.
   */
  public List<MessageResponse> getMessagesSince(
      String userId, String conversationId, Instant afterTimestamp) {
    Conversation conversation =
        conversationRepository
            .findById(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
    if (!conversation.getParticipants().contains(userId)) {
      throw new ConversationNotFoundException(conversationId);
    }
    Instant clearedAt =
        conversation.getClearedAt() == null ? null : conversation.getClearedAt().get(userId);

    Pageable pageable = PageRequest.of(0, 50, Sort.by(Sort.Direction.ASC, "createdAt"));
    List<Message> rows =
        messageRepository.findByConversationIdAndCreatedAtGreaterThanOrderByCreatedAtAsc(
            conversationId, afterTimestamp, pageable);

    return rows.stream()
        .filter(m -> m.getDeletedFor() == null || !m.getDeletedFor().contains(userId))
        .filter(
            m ->
                clearedAt == null
                    || m.getCreatedAt() == null
                    || m.getCreatedAt().isAfter(clearedAt))
        .map(this::toResponse)
        .toList();
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

  /**
   * Fetch the last {@code limit} non-recalled messages in chronological order for building AI
   * conversation history. Returns an empty list on any error so AI request failure never disrupts
   * the main send flow.
   */
  private static final Set<String> AI_HISTORY_SKIP_TYPES =
      Set.of("voice", "file", "sticker", "system", "call_log", "meeting_summary");

  private static final Pattern AI_MENTION_STRIP = Pattern.compile("(?i)@(AI|ponai)\\b");

  private static final ObjectMapper AI_HISTORY_MAPPER = new ObjectMapper();

  /**
   * Build the AI conversation history (TASK-10). Text turns produce a plain {@code role}/{@code
   * content} entry (unchanged). {@code image} turns are NOT flattened to a useless URL string
   * anymore — they carry {@code type="image"} + {@code imageUrls} (parsed from the message content,
   * which is a single URL or a JSON array, mirroring web's {@code parseImageUrls}) so ai-service
   * can render them as image content blocks. Caption is the (usually empty) text.
   */
  /**
   * Resolve a user's human-readable display name for the AI system prompt. Falls back to the raw
   * userId only if the lookup yields nothing, so the AI is never addressed with a bare ObjectId
   * when a name is available.
   */
  public String resolveDisplayName(String userId) {
    String name = helper.lookupDisplayName(userId);
    return (name != null && !name.isBlank()) ? name : userId;
  }

  public List<AiHistoryEntry> getAiHistory(String userId, String conversationId) {
    try {
      PageResponse<MessageResponse> paged = getMessages(userId, conversationId, null, 50);
      List<AiHistoryEntry> history = new ArrayList<>();
      for (MessageResponse msg : paged.content()) {
        if (history.size() >= 20) break;
        if (msg.recalled() || msg.content() == null || msg.content().isBlank()) continue;
        if (AI_HISTORY_SKIP_TYPES.contains(msg.type())) continue;
        String role = AiConstants.AI_BOT_USER_ID.equals(msg.senderId()) ? "assistant" : "user";

        if ("image".equals(msg.type())) {
          List<String> imageUrls = parseImageUrls(msg.content());
          if (imageUrls.isEmpty()) continue;
          // No caption field on image messages today — caption stays empty.
          history.add(AiHistoryEntry.image(role, "", imageUrls));
          continue;
        }

        String content = AI_MENTION_STRIP.matcher(msg.content()).replaceAll("").trim();
        if (content.isBlank()) continue;
        history.add(AiHistoryEntry.text(role, content));
      }
      Collections.reverse(history); // newest-first → chronological
      return history;
    } catch (Exception e) {
      return List.of();
    }
  }

  /**
   * Parse an {@code image}-message content that is either a single URL or a JSON array of URLs
   * (mirrors web {@code parseImageUrls} / Flutter). Non-JSON content is treated as a single URL.
   * Blank entries are dropped.
   */
  private static List<String> parseImageUrls(String content) {
    String trimmed = content.trim();
    if (trimmed.startsWith("[")) {
      try {
        List<String> urls =
            AI_HISTORY_MAPPER.readValue(trimmed, new TypeReference<List<String>>() {});
        List<String> cleaned = new ArrayList<>();
        for (String u : urls) {
          if (u != null && !u.isBlank()) cleaned.add(u);
        }
        return cleaned;
      } catch (Exception ignored) {
        // not a JSON array — fall through to single-URL handling
      }
    }
    return List.of(trimmed);
  }

  /**
   * Conversation-scoped message search (Task 50). Case-insensitive substring match on {@code
   * content}, newest first, excluding recalled messages, messages the user deleted for themselves,
   * and history before their clear-cutoff. Caller must be a participant.
   */
  public List<MessageResponse> searchMessages(String userId, String conversationId, String query) {
    Conversation conversation =
        conversationRepository
            .findById(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
    if (!conversation.getParticipants().contains(userId)) {
      throw new ConversationNotFoundException(conversationId);
    }
    if (query == null || query.trim().isEmpty()) {
      return List.of();
    }
    Instant clearedAt =
        conversation.getClearedAt() == null ? null : conversation.getClearedAt().get(userId);

    String escaped = java.util.regex.Pattern.quote(query.trim());
    Query q =
        new Query(
                Criteria.where("conversationId")
                    .is(conversationId)
                    .and("recalled")
                    .ne(true)
                    .and("content")
                    .regex(escaped, "i"))
            .with(Sort.by(Sort.Direction.DESC, "createdAt"))
            .limit(50);
    List<Message> rows = mongoTemplate.find(q, Message.class);

    return rows.stream()
        .filter(m -> m.getDeletedFor() == null || !m.getDeletedFor().contains(userId))
        .filter(
            m ->
                clearedAt == null
                    || m.getCreatedAt() == null
                    || m.getCreatedAt().isAfter(clearedAt))
        .map(this::toResponse)
        .toList();
  }
}
