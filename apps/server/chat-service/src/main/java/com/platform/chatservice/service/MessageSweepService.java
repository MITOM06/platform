package com.platform.chatservice.service;

import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Background sweep for disappearing-messages. Extracted from {@code MessageService} to keep that
 * class within the clean-code line limit. Behavior is unchanged: after a sweep removes messages,
 * the conversation's lastMessage/lastMessageAt are refreshed from the newest remaining message.
 */
@Service
@RequiredArgsConstructor
public class MessageSweepService {

  private final MongoTemplate mongoTemplate;
  private final ConversationRepository conversationRepository;

  /** Background sweep removing messages past each conversation's disappearing-messages window. */
  @Scheduled(fixedDelayString = "${app.auto-delete.sweep-interval-ms:300000}")
  public void sweepExpiredMessages() {
    List<Conversation> conversations =
        mongoTemplate.find(
            new Query(Criteria.where("autoDeleteSeconds").gt(0)), Conversation.class);
    for (Conversation conversation : conversations) {
      Integer seconds = conversation.getAutoDeleteSeconds();
      if (seconds == null || seconds <= 0) continue;
      Instant cutoff = Instant.now().minus(seconds, ChronoUnit.SECONDS);
      var removed =
          mongoTemplate.remove(
              new Query(
                  Criteria.where("conversationId")
                      .is(conversation.getId())
                      .and("createdAt")
                      .lt(cutoff)),
              Message.class);
      // If nothing was swept, the conversation preview is already accurate.
      if (removed.getDeletedCount() == 0) continue;
      // Refresh lastMessage/lastMessageAt from the newest remaining message so the
      // conversation preview doesn't keep showing a message that was just deleted.
      refreshLastMessage(conversation.getId());
    }
  }

  /** Recompute a conversation's lastMessage/lastMessageAt from its newest remaining message. */
  private void refreshLastMessage(String conversationId) {
    Query latestQuery =
        new Query(Criteria.where("conversationId").is(conversationId))
            .with(Sort.by(Sort.Direction.DESC, "createdAt"))
            .limit(1);
    Message latest = mongoTemplate.findOne(latestQuery, Message.class);
    conversationRepository
        .findById(conversationId)
        .ifPresent(
            conv -> {
              if (latest == null) {
                conv.setLastMessage(null);
                conv.setLastMessageAt(null);
              } else {
                conv.setLastMessage(
                    Conversation.LastMessage.builder()
                        .content(latest.getContent())
                        .senderId(latest.getSenderId())
                        .createdAt(latest.getCreatedAt())
                        .build());
                conv.setLastMessageAt(latest.getCreatedAt());
              }
              conversationRepository.save(conv);
            });
  }
}
