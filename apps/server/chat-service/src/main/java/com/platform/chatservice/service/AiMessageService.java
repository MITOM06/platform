package com.platform.chatservice.service;

import com.platform.chatservice.dto.AiTraceResponse;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.exception.MessageNotFoundException;
import com.platform.chatservice.model.AiTraceData;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.time.Instant;
import java.util.ArrayList;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * AI message persistence + trace retrieval. Extracted from {@code MessageService} to keep that
 * class within the clean-code line limit. Behavior is unchanged: {@link #saveAiMessage} still
 * performs the single broadcast of the saved AI message to the conversation topic.
 */
@Service
@RequiredArgsConstructor
public class AiMessageService {

  private final MessageRepository messageRepository;
  private final ConversationRepository conversationRepository;
  private final SimpMessagingTemplate messagingTemplate;
  private final MessageMapper messageMapper;

  /**
   * Save an AI-generated message (with optional trace) and broadcast it to the conversation topic.
   * Called by AiResponseListener when AI_STREAM_DONE is received from Redis.
   */
  public MessageResponse saveAiMessage(String conversationId, String content, AiTraceData trace) {
    Message message =
        messageRepository.save(
            Message.builder()
                .conversationId(conversationId)
                .senderId(AiConstants.AI_BOT_USER_ID)
                .content(content)
                .type("ai")
                .readBy(new ArrayList<>())
                .trace(trace)
                .build());

    Instant savedAt = message.getCreatedAt() != null ? message.getCreatedAt() : Instant.now();
    conversationRepository
        .findById(conversationId)
        .ifPresent(
            conv -> {
              conv.setLastMessage(
                  Conversation.LastMessage.builder()
                      .content(content)
                      .senderId(AiConstants.AI_BOT_USER_ID)
                      .createdAt(savedAt)
                      .build());
              conv.setLastMessageAt(savedAt);
              conversationRepository.save(conv);
            });

    MessageResponse response = messageMapper.toResponse(message);
    messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, response);
    return response;
  }

  /**
   * Returns the AI trace for a message. Throws 404 if message not found or trace is null (regular
   * non-AI messages have no trace).
   */
  public AiTraceResponse getMessageTrace(String userId, String messageId) {
    Message message =
        messageRepository
            .findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException("Message not found: " + messageId));
    boolean isParticipant =
        conversationRepository
            .findById(message.getConversationId())
            .map(c -> c.getParticipants() != null && c.getParticipants().contains(userId))
            .orElse(false);
    if (!isParticipant) {
      throw new ForbiddenException("Not a participant");
    }
    if (message.getTrace() == null) {
      throw new MessageNotFoundException("No trace for message: " + messageId);
    }
    return AiTraceResponse.from(message.getTrace());
  }
}
