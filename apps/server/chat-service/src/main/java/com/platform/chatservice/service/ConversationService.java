package com.platform.chatservice.service;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.DuplicateConversationException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final MongoTemplate mongoTemplate;

    public PageResponse<ConversationResponse> listConversations(String userId, Pageable pageable) {
        Page<Conversation> page = conversationRepository
            .findByParticipantsContainingOrderByLastMessageAtDesc(userId, pageable);
        
        List<Conversation> conversations = page.getContent();
        List<String> conversationIds = conversations.stream().map(Conversation::getId).toList();
        
        Map<String, Long> unreadCounts = getUnreadCounts(conversationIds, userId);

        List<ConversationResponse> content = conversations.stream()
            .map(c -> toResponse(c, userId, unreadCounts.getOrDefault(c.getId(), 0L)))
            .toList();
            
        return new PageResponse<>(content, page.getNumber(), page.getSize(), page.getTotalElements());
    }

    public ConversationResponse createConversation(String currentUserId, String participantId) {
        List<String> participants = List.of(currentUserId, participantId);
        conversationRepository.findOneOnOneConversation(participants).ifPresent(existing -> {
            throw new DuplicateConversationException(existing.getId());
        });
        Conversation saved = conversationRepository.save(
            Conversation.builder().participants(participants).build()
        );
        return toResponse(saved, currentUserId, 0L);
    }

    public ConversationResponse getConversation(String userId, String conversationId) {
        Conversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
        if (!conversation.getParticipants().contains(userId)) {
            throw new ConversationNotFoundException(conversationId);
        }
        long unreadCount = messageRepository.countUnread(conversationId, userId);
        return toResponse(conversation, userId, unreadCount);
    }

    private Map<String, Long> getUnreadCounts(List<String> conversationIds, String userId) {
        if (conversationIds.isEmpty()) {
            return Map.of();
        }

        Aggregation aggregation = Aggregation.newAggregation(
            Aggregation.match(Criteria.where("conversationId").in(conversationIds)
                .and("readBy").nin(userId)),
            Aggregation.group("conversationId").count().as("count")
        );

        List<Document> results = mongoTemplate.aggregate(
            aggregation, "messages", Document.class
        ).getMappedResults();

        return results.stream()
            .collect(Collectors.toMap(
                doc -> doc.get("_id", String.class),
                doc -> ((Number) doc.get("count")).longValue()
            ));
    }

    public List<String> getParticipants(String conversationId) {
        return conversationRepository.findById(conversationId)
            .map(Conversation::getParticipants)
            .orElse(List.of());
    }

    private ConversationResponse toResponse(Conversation c, String userId, long unreadCount) {
        ConversationResponse.LastMessageDto lastMsg = null;
        if (c.getLastMessage() != null) {
            lastMsg = new ConversationResponse.LastMessageDto(
                c.getLastMessage().getContent(),
                c.getLastMessage().getSenderId(),
                c.getLastMessage().getCreatedAt()
            );
        }
        return new ConversationResponse(
            c.getId(), c.getParticipants(), lastMsg,
            c.getLastMessageAt(), unreadCount, c.getCreatedAt()
        );
    }
}
