package com.platform.chatservice.service;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.ConversationRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
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

  // Lists the user's conversations. When archived is true only archived
  // conversations are returned; otherwise archived ones are excluded.
  public PageResponse<ConversationResponse> listConversations(
      String userId, Pageable pageable, boolean archived) {
    Page<Conversation> page =
        conversationRepository.findByParticipantsContainingOrderByLastMessageAtDesc(
            userId, pageable);

    List<Conversation> conversations =
        page.getContent().stream()
            .filter(c -> c.getHiddenFor() == null || !c.getHiddenFor().contains(userId))
            .filter(c -> c.getBlockedBy() == null || !c.getBlockedBy().contains(userId))
            .filter(
                c -> {
                  boolean isArchived =
                      c.getArchivedBy() != null && c.getArchivedBy().contains(userId);
                  return archived == isArchived;
                })
            .toList();

    List<String> conversationIds = conversations.stream().map(Conversation::getId).toList();

    Map<String, Long> unreadCounts = getUnreadCounts(conversationIds, userId);

    List<ConversationResponse> content =
        conversations.stream()
            .map(
                c ->
                    conversationMapper.toResponse(
                        c, userId, unreadCounts.getOrDefault(c.getId(), 0L)))
            .toList();

    return new PageResponse<>(content, page.getNumber(), page.getSize(), page.getTotalElements());
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
    Page<Conversation> page =
        (query != null && !query.isBlank())
            ? conversationRepository.findPublicGroupsByName(query.trim(), pageable)
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
