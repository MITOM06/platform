package com.platform.chatservice.service;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.ConversationRepository;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/**
 * Read-side of the conversation domain: listing (active/archived/blocked), public-channel
 * discovery, unread-count aggregation and lightweight participant/mute lookups. Extracted from
 * {@code ConversationService} to keep that class focused on mutations and to stay within the
 * clean-code file-length limit. Behavior is identical to the original methods.
 */
@Service
@RequiredArgsConstructor
public class ConversationQueryService {

  private final ConversationRepository conversationRepository;
  private final ConversationCacheService conversationCacheService;
  private final MongoTemplate mongoTemplate;
  private final ConversationMapper conversationMapper;

  public PageResponse<ConversationResponse> listConversations(String userId, Pageable pageable) {
    return listConversations(userId, pageable, false);
  }

  /** Max length of a public-channel search term (it becomes a case-insensitive regex). */
  private static final int MAX_SEARCH_LENGTH = 100;

  /**
   * Lists the user's conversations, newest activity first. {@code archived=true} returns only the
   * archived ones; otherwise archived ones are excluded. Hidden ("deleted for me") and Blocked
   * conversations never appear here.
   *
   * <p>Every filter is part of the Mongo query, so paging is over the rows the user can actually
   * see. It used to fetch a page of 20 and drop hidden/blocked/archived rows afterwards, which
   * under-filled pages and made conversations past the first page (and most archived ones)
   * unreachable.
   */
  public PageResponse<ConversationResponse> listConversations(
      String userId, Pageable pageable, boolean archived) {
    Criteria criteria =
        Criteria.where("participants")
            .is(userId)
            .and("hiddenFor")
            .ne(userId)
            .and("blockedBy")
            .ne(userId);
    if (archived) {
      criteria = criteria.and("archivedBy").is(userId);
    } else {
      criteria = criteria.and("archivedBy").ne(userId);
    }
    Query query =
        new Query(criteria)
            .with(
                Sort.by(Sort.Direction.DESC, "lastMessageAt")
                    .and(Sort.by(Sort.Direction.DESC, "_id")))
            .skip(pageable.getOffset())
            .limit(pageable.getPageSize());
    List<Conversation> conversations = mongoTemplate.find(query, Conversation.class);
    long total = mongoTemplate.count(new Query(criteria), Conversation.class);

    List<String> conversationIds = conversations.stream().map(Conversation::getId).toList();
    Map<String, Long> unreadCounts = getUnreadCounts(conversationIds, userId);

    List<ConversationResponse> content =
        conversations.stream()
            .map(
                c ->
                    conversationMapper.toResponse(
                        c, userId, unreadCounts.getOrDefault(c.getId(), 0L)))
            .toList();

    return new PageResponse<>(content, pageable.getPageNumber(), pageable.getPageSize(), total);
  }

  private Map<String, Long> getUnreadCounts(List<String> conversationIds, String userId) {
    if (conversationIds.isEmpty()) {
      return Map.of();
    }

    Aggregation aggregation =
        Aggregation.newAggregation(
            Aggregation.match(
                Criteria.where("conversationId").in(conversationIds).and("readBy").nin(userId)),
            Aggregation.group("conversationId").count().as("count"));

    List<Document> results =
        mongoTemplate.aggregate(aggregation, "messages", Document.class).getMappedResults();

    return results.stream()
        .collect(
            Collectors.toMap(
                doc -> doc.get("_id", String.class),
                doc -> ((Number) doc.get("count")).longValue()));
  }

  /** List public group channels visible to everyone, optionally filtered by name. */
  public PageResponse<ConversationResponse> listPublicChannels(String query, Pageable pageable) {
    String term = query == null ? "" : query.trim();
    if (term.length() > MAX_SEARCH_LENGTH) {
      term = term.substring(0, MAX_SEARCH_LENGTH);
    }
    // The term is matched as a regex — quote it so user input is a literal substring, not a
    // pattern (a crafted pattern could be catastrophically slow or match unintended names).
    Page<Conversation> page =
        !term.isEmpty()
            ? conversationRepository.findPublicGroupsByName(Pattern.quote(term), pageable)
            : conversationRepository.findPublicGroups(pageable);
    List<ConversationResponse> content =
        page.getContent().stream().map(c -> conversationMapper.toResponse(c, null, 0L)).toList();
    return new PageResponse<>(content, page.getNumber(), page.getSize(), page.getTotalElements());
  }

  public List<String> getParticipants(String conversationId) {
    return conversationCacheService
        .findByIdOptional(conversationId)
        .map(Conversation::getParticipants)
        .orElse(List.of());
  }

  public boolean isMuted(String conversationId, String userId) {
    return conversationCacheService
        .findByIdOptional(conversationId)
        .map(
            conv -> {
              if (conv.getMutedUntil() == null) return false;
              Long until = conv.getMutedUntil().get(userId);
              return until != null && until > System.currentTimeMillis();
            })
        .orElse(false);
  }

  /** Returns conversations the user has moved to the Blocked section. */
  public PageResponse<ConversationResponse> listBlockedConversations(
      String userId, Pageable pageable) {
    Page<Conversation> page =
        conversationRepository
            .findByParticipantsContainingAndBlockedByContainingOrderByLastMessageAtDesc(
                userId, userId, pageable);
    List<String> conversationIds = page.getContent().stream().map(Conversation::getId).toList();
    Map<String, Long> unreadCounts = getUnreadCounts(conversationIds, userId);
    List<ConversationResponse> content =
        page.getContent().stream()
            .map(
                c ->
                    conversationMapper.toResponse(
                        c, userId, unreadCounts.getOrDefault(c.getId(), 0L)))
            .toList();
    return new PageResponse<>(content, page.getNumber(), page.getSize(), page.getTotalElements());
  }
}
