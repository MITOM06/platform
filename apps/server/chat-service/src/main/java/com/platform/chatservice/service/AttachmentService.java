package com.platform.chatservice.service;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Shared Media & Links Gallery (Task 57).
 * Kept separate from MessageService to stay within the 500-line limit.
 */
@Service
@RequiredArgsConstructor
public class AttachmentService {

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final MessageService messageService;

    /**
     * Returns paginated attachments for a conversation filtered by {@code type}:
     * <ul>
     *   <li>{@code media} — images and videos</li>
     *   <li>{@code file} — generic uploaded documents</li>
     *   <li>{@code link} — text messages containing an http(s) URL</li>
     * </ul>
     */
    public PageResponse<MessageResponse> getSharedAttachments(
            String userId, String conversationId, String type, Pageable pageable) {

        Conversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
        if (!conversation.getParticipants().contains(userId)) {
            throw new ConversationNotFoundException(conversationId);
        }

        Page<Message> page;
        if ("link".equals(type)) {
            page = messageRepository.findLinksByConversationId(conversationId, pageable);
        } else if ("file".equals(type)) {
            page = messageRepository.findByConversationIdAndTypeInOrderByCreatedAtDesc(
                conversationId, List.of("file"), pageable);
        } else {
            // default: media (image + video)
            page = messageRepository.findByConversationIdAndTypeInOrderByCreatedAtDesc(
                conversationId, List.of("image", "video"), pageable);
        }

        List<MessageResponse> content = page.getContent().stream()
            .filter(m -> !m.isRecalled())
            .map(messageService::toResponse)
            .toList();

        return new PageResponse<>(content, pageable.getPageNumber(),
            pageable.getPageSize(), page.getTotalElements());
    }
}
