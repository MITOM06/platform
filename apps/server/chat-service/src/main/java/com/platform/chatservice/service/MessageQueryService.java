package com.platform.chatservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.dto.AiHistoryEntry;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.exception.ConversationNotFoundException;
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
import org.springframework.stereotype.Service;

/**
 * Read-side of the message domain: cursor pagination, offline catch-up, in-conversation search,
 * display-name resolution and AI conversation-history assembly. Extracted from {@code
 * MessageService} to keep that class focused on writes/mutations and to stay within the clean-code
 * file-length limit. Behavior is identical to the original methods.
 */
@Service
@RequiredArgsConstructor
public class MessageQueryService {

  private final MessageRepository messageRepository;
  private final ConversationRepository conversationRepository;
  private final MongoTemplate mongoTemplate;
  private final MessageServiceHelper helper;
  private final MessageMapper messageMapper;

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

  private static final Set<String> AI_HISTORY_SKIP_TYPES =
      Set.of("voice", "file", "sticker", "system", "call_log", "meeting_summary");

  private static final Pattern AI_MENTION_STRIP = Pattern.compile("(?i)@(AI|ponai)\\b");

  private static final ObjectMapper AI_HISTORY_MAPPER = new ObjectMapper();

  /**
   * Resolve a user's human-readable display name for the AI system prompt. Falls back to the raw
   * userId only if the lookup yields nothing, so the AI is never addressed with a bare ObjectId
   * when a name is available.
   */
  public String resolveDisplayName(String userId) {
    String name = helper.lookupDisplayName(userId);
    return (name != null && !name.isBlank()) ? name : userId;
  }

  /**
   * Build the AI conversation history (TASK-10). Text turns produce a plain {@code role}/{@code
   * content} entry (unchanged). {@code image} turns are NOT flattened to a useless URL string
   * anymore — they carry {@code type="image"} + {@code imageUrls} (parsed from the message content,
   * which is a single URL or a JSON array, mirroring web's {@code parseImageUrls}) so ai-service
   * can render them as image content blocks. Caption is the (usually empty) text.
   */
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

  private MessageResponse toResponse(Message m) {
    return messageMapper.toResponse(m);
  }
}
