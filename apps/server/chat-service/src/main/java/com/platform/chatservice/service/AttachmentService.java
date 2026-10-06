package com.platform.chatservice.service;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/**
 * Shared Media & Links Gallery (Task 57). Kept separate from MessageService to stay within the
 * 500-line limit.
 */
@Service
@RequiredArgsConstructor
public class AttachmentService {

  private final ConversationRepository conversationRepository;
  private final MongoTemplate mongoTemplate;
  private final MessageMapper messageMapper;

  /**
   * Returns paginated attachments for a conversation filtered by {@code type}:
   *
   * <ul>
   *   <li>{@code media} — images and videos
   *   <li>{@code file} — generic uploaded documents
   *   <li>{@code link} — text messages containing an http(s) URL
   * </ul>
   *
   * The same visibility rules as the message history apply: recalled messages, messages the user
   * deleted for themselves, and anything before their clear-history cutoff are excluded — in the
   * query, so pages stay full and the total is right.
   */
  public PageResponse<MessageResponse> getSharedAttachments(
      String userId, String conversationId, String type, Pageable pageable) {

    Conversation conversation =
        conversationRepository
            .findById(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
    if (conversation.getParticipants() == null
        || !conversation.getParticipants().contains(userId)) {
      throw new ConversationNotFoundException(conversationId);
    }
    Instant clearedAt =
        conversation.getClearedAt() == null ? null : conversation.getClearedAt().get(userId);

    Criteria criteria =
        Criteria.where("conversationId")
            .is(conversationId)
            .and("recalled")
            .ne(true)
            .and("deletedFor")
            .ne(userId);
    if ("link".equals(type)) {
      criteria = criteria.and("type").is("text").and("content").regex("https?://", "i");
    } else if ("file".equals(type)) {
      criteria = criteria.and("type").is("file");
    } else {
      // default: media (image + video)
      criteria = criteria.and("type").in(List.of("image", "video"));
    }
    if (clearedAt != null) {
      criteria = criteria.and("createdAt").gt(clearedAt);
    }

    Query query =
        new Query(criteria)
            .with(Sort.by(Sort.Direction.DESC, "createdAt"))
            .skip(pageable.getOffset())
            .limit(pageable.getPageSize());
    List<MessageResponse> content =
        mongoTemplate.find(query, Message.class).stream().map(messageMapper::toResponse).toList();
    long total = mongoTemplate.count(new Query(criteria), Message.class);

    return new PageResponse<>(content, pageable.getPageNumber(), pageable.getPageSize(), total);
  }
}
