package com.platform.chatservice.service;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.DuplicateConversationException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    public PageResponse<ConversationResponse> listConversations(String userId, Pageable pageable) {
        Page<Conversation> page = conversationRepository
            .findByParticipantsContainingOrderByLastMessageAtDesc(userId, pageable);
        List<ConversationResponse> content = page.getContent().stream()
            .map(c -> toResponse(c, userId))
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
        return toResponse(saved, currentUserId);
    }

    public ConversationResponse getConversation(String userId, String conversationId) {
        Conversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
        if (!conversation.getParticipants().contains(userId)) {
            throw new ConversationNotFoundException(conversationId);
        }
        return toResponse(conversation, userId);
    }

    private ConversationResponse toResponse(Conversation c, String userId) {
        long unreadCount = messageRepository.countUnread(c.getId(), userId);
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
