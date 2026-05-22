package com.platform.chatservice.service;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.MessageNotFoundException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import com.mongodb.client.result.UpdateResult;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final MongoTemplate mongoTemplate;

    public PageResponse<MessageResponse> getMessages(String userId, String conversationId, Pageable pageable) {
        Conversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
        if (!conversation.getParticipants().contains(userId)) {
            throw new ConversationNotFoundException(conversationId);
        }
        Page<Message> page = messageRepository.findByConversationIdOrderByCreatedAtDesc(conversationId, pageable);
        List<MessageResponse> content = page.getContent().stream().map(this::toResponse).toList();
        return new PageResponse<>(content, page.getNumber(), page.getSize(), page.getTotalElements());
    }

    public MessageResponse sendMessage(String senderId, SendMessageRequest request) {
        Conversation conversation = conversationRepository.findById(request.conversationId())
            .orElseThrow(() -> new ConversationNotFoundException(request.conversationId()));
        if (!conversation.getParticipants().contains(senderId)) {
            throw new ConversationNotFoundException(request.conversationId());
        }
        Message message = messageRepository.save(Message.builder()
            .conversationId(request.conversationId())
            .senderId(senderId)
            .content(request.content())
            .type(request.type() != null ? request.type() : "text")
            .readBy(new ArrayList<>(List.of(senderId)))
            .build());

        Instant sentAt = message.getCreatedAt() != null ? message.getCreatedAt() : Instant.now();
        conversation.setLastMessage(Conversation.LastMessage.builder()
            .content(message.getContent())
            .senderId(senderId)
            .createdAt(sentAt)
            .build());
        conversation.setLastMessageAt(sentAt);
        conversationRepository.save(conversation);

        return toResponse(message);
    }

    public void markAsRead(String userId, String messageId) {
        Query query = new Query(Criteria.where("id").is(messageId));
        Update update = new Update().addToSet("readBy", userId);
        UpdateResult result = mongoTemplate.updateFirst(query, update, Message.class);
        if (result.getMatchedCount() == 0) {
            throw new MessageNotFoundException(messageId);
        }
    }

    private MessageResponse toResponse(Message m) {
        return new MessageResponse(
            m.getId(), m.getConversationId(), m.getSenderId(),
            m.getContent(), m.getType(), m.getReadBy(), m.getCreatedAt()
        );
    }
}
