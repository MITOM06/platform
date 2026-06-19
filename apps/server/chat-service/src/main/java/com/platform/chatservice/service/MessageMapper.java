package com.platform.chatservice.service;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.model.Message;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Maps {@link Message} documents to {@link MessageResponse} DTOs. Extracted from {@code
 * MessageService} so collaborator services (AI persistence, sweeps) can reuse the exact same
 * projection without duplicating it.
 */
@Component
public class MessageMapper {

  public MessageResponse toResponse(Message m) {
    List<MessageResponse.ReactionDto> reactions =
        m.getReactions() == null
            ? List.of()
            : m.getReactions().stream()
                .map(r -> new MessageResponse.ReactionDto(r.getUserId(), r.getEmoji()))
                .toList();
    MessageResponse.ReplyPreviewDto replyPreview =
        m.getReplyPreview() == null
            ? null
            : new MessageResponse.ReplyPreviewDto(
                m.getReplyPreview().getMessageId(),
                m.getReplyPreview().getSenderId(),
                m.getReplyPreview().getContent());
    return new MessageResponse(
        m.getId(),
        m.getConversationId(),
        m.getSenderId(),
        m.getContent(),
        m.getType(),
        m.getReadBy(),
        m.getCreatedAt(),
        m.getReplyToId(),
        replyPreview,
        reactions,
        m.isRecalled(),
        m.getEditedAt(),
        m.getMentions() == null ? List.of() : m.getMentions());
  }
}
