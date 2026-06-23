package com.platform.chatservice.service;

import com.platform.chatservice.dto.AiFeedbackRequest;
import com.platform.chatservice.dto.AiFeedbackResponse;
import com.platform.chatservice.exception.MessageNotFoundException;
import com.platform.chatservice.model.AiFeedback;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.AiFeedbackRepository;
import com.platform.chatservice.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Manages per-user 👍/👎 feedback on AI messages. Upserts exactly one {@link AiFeedback} document
 * per (userId, messageId); a "none" rating clears (deletes) the user's vote.
 */
@Service
@RequiredArgsConstructor
public class AiFeedbackService {

  private static final String RATING_NONE = "none";

  private final AiFeedbackRepository aiFeedbackRepository;
  private final MessageRepository messageRepository;

  /**
   * Records, updates, or clears the requesting user's feedback for a message.
   *
   * @throws MessageNotFoundException if the message does not exist (→ 404)
   */
  public AiFeedbackResponse submitFeedback(
      String userId, String messageId, AiFeedbackRequest request) {
    Message message =
        messageRepository
            .findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));

    String rating = request.rating();

    if (rating == null || RATING_NONE.equalsIgnoreCase(rating)) {
      aiFeedbackRepository.deleteByUserIdAndMessageId(userId, messageId);
      return new AiFeedbackResponse(RATING_NONE, null);
    }

    AiFeedback feedback =
        aiFeedbackRepository
            .findByUserIdAndMessageId(userId, messageId)
            .orElseGet(
                () ->
                    AiFeedback.builder()
                        .userId(userId)
                        .messageId(messageId)
                        .conversationId(message.getConversationId())
                        .build());

    feedback.setConversationId(message.getConversationId());
    feedback.setRating(rating);
    feedback.setComment(request.comment());

    AiFeedback saved = aiFeedbackRepository.save(feedback);
    return new AiFeedbackResponse(saved.getRating(), saved.getComment());
  }
}
