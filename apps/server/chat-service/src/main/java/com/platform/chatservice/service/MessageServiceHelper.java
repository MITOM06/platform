package com.platform.chatservice.service;

import com.platform.chatservice.exception.ConversationNotFoundException;
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

  Message.ReplyPreview buildReplyPreview(String replyToId) {
    if (replyToId == null || replyToId.isBlank()) return null;
    return messageRepository
        .findById(replyToId)
        .map(
            m ->
                Message.ReplyPreview.builder()
                    .messageId(m.getId())
                    .senderId(m.getSenderId())
                    .content(snippet(m.getContent()))
                    .build())
        .orElse(null);
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
