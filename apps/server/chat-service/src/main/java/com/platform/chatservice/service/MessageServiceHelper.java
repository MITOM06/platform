package com.platform.chatservice.service;

import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.exception.MessageNotFoundException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import com.platform.chatservice.repository.UserBlockRepository;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class MessageServiceHelper {

  private final MessageRepository messageRepository;
  private final ConversationRepository conversationRepository;
  private final UserBlockRepository userBlockRepository;
  private final MongoTemplate mongoTemplate;

  boolean isBlockedBetween(String a, String b) {
    return blocks(a, b) || blocks(b, a);
  }

  private boolean blocks(String ownerId, String targetId) {
    return userBlockRepository.existsByBlockerIdAndBlockedId(ownerId, targetId);
  }

  Message requireParticipantMessage(String userId, String messageId) {
    Message message =
        messageRepository
            .findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));
    Conversation conversation =
        conversationRepository
            .findById(message.getConversationId())
            .orElseThrow(() -> new ConversationNotFoundException(message.getConversationId()));
    if (!conversation.getParticipants().contains(userId)) {
      throw new ForbiddenException("Not a participant of this conversation");
    }
    return message;
  }

  /**
   * Snapshot of the message being replied to. The target must live in the SAME conversation: {@code
   * replyToId} used to be looked up globally, so replying in one chat with the id of a message from
   * someone else's private chat copied that message's text into {@code replyPreview}. An unknown or
   * foreign id is rejected with {@code 400 REPLY_TARGET_INVALID}.
   */
  Message.ReplyPreview buildReplyPreview(String replyToId, String conversationId) {
    if (replyToId == null || replyToId.isBlank()) return null;
    Message target =
        messageRepository
            .findById(replyToId)
            .filter(m -> conversationId != null && conversationId.equals(m.getConversationId()))
            .orElseThrow(
                () ->
                    new BadRequestException(
                        ErrorCodes.REPLY_TARGET_INVALID,
                        "Reply target is not a message of this conversation"));
    return Message.ReplyPreview.builder()
        .messageId(target.getId())
        .senderId(target.getSenderId())
        .content(target.isRecalled() ? "" : snippet(target.getContent()))
        .recalled(target.isRecalled())
        .build();
  }

  private String snippet(String content) {
    if (content == null) return "";
    return content.length() <= 80 ? content : content.substring(0, 80) + "…";
  }

  List<String> parseMentions(String content, List<String> participants, String senderId) {
    if (content == null || content.indexOf('@') < 0 || participants == null) {
      return List.of();
    }
    List<String> others = participants.stream().filter(p -> !p.equals(senderId)).toList();
    if (others.isEmpty()) {
      return List.of();
    }
    String lower = content.toLowerCase();
    List<String> mentioned = new ArrayList<>();
    for (String userId : others) {
      String displayName = lookupDisplayName(userId);
      if (displayName != null
          && !displayName.isBlank()
          && lower.contains("@" + displayName.toLowerCase())) {
        mentioned.add(userId);
      }
    }
    return mentioned;
  }

  String lookupDisplayName(String userId) {
    try {
      Query query = new Query(Criteria.where("_id").is(new ObjectId(userId)));
      query.fields().include("displayName");
      Document doc = mongoTemplate.findOne(query, Document.class, "users");
      return doc == null ? null : doc.getString("displayName");
    } catch (Exception e) {
      return null;
    }
  }
}
