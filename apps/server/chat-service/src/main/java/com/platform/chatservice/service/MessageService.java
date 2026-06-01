package com.platform.chatservice.service;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.SendMessageRequest;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.MessageNotFoundException;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.model.UserBlock;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import com.platform.chatservice.repository.UserBlockRepository;
import com.mongodb.client.result.UpdateResult;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MessageService {

    private static final String SYSTEM_SENDER = "system";

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final UserBlockRepository userBlockRepository;
    private final MongoTemplate mongoTemplate;

    public PageResponse<MessageResponse> getMessages(String userId, String conversationId, Pageable pageable) {
        Conversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
        if (!conversation.getParticipants().contains(userId)) {
            throw new ConversationNotFoundException(conversationId);
        }
        Instant clearedAt = conversation.getClearedAt() == null ? null
            : conversation.getClearedAt().get(userId);

        Page<Message> page = messageRepository.findByConversationIdOrderByCreatedAtDesc(conversationId, pageable);
        List<MessageResponse> content = page.getContent().stream()
            .filter(m -> m.getDeletedFor() == null || !m.getDeletedFor().contains(userId))
            .filter(m -> clearedAt == null || m.getCreatedAt() == null || m.getCreatedAt().isAfter(clearedAt))
            .map(this::toResponse)
            .toList();
        return new PageResponse<>(content, page.getNumber(), page.getSize(), page.getTotalElements());
    }

    public MessageResponse sendMessage(String senderId, SendMessageRequest request) {
        if (request.content() == null || request.content().trim().isEmpty()) {
            throw new IllegalArgumentException("Message content cannot be empty");
        }
        Conversation conversation = conversationRepository.findById(request.conversationId())
            .orElseThrow(() -> new ConversationNotFoundException(request.conversationId()));
        if (!conversation.getParticipants().contains(senderId)) {
            throw new ConversationNotFoundException(request.conversationId());
        }
        // Block User: reject if the sender blocked, or is blocked by, any other
        // participant of the conversation (covers both directions).
        for (String participant : conversation.getParticipants()) {
            if (!participant.equals(senderId) && isBlockedBetween(senderId, participant)) {
                throw new UnauthorizedException("Cannot send message: user is blocked");
            }
        }

        Message.ReplyPreview replyPreview = buildReplyPreview(request.replyToId());

        Message message = messageRepository.save(Message.builder()
            .conversationId(request.conversationId())
            .senderId(senderId)
            .content(request.content())
            .type(request.type() != null ? request.type() : "text")
            .readBy(new ArrayList<>(List.of(senderId)))
            .replyToId(request.replyToId())
            .replyPreview(replyPreview)
            .build());

        Instant sentAt = message.getCreatedAt() != null ? message.getCreatedAt() : Instant.now();
        conversation.setLastMessage(Conversation.LastMessage.builder()
            .content(message.getContent())
            .senderId(senderId)
            .createdAt(sentAt)
            .build());
        conversation.setLastMessageAt(sentAt);
        // A new message un-hides the conversation for everyone who had deleted it.
        conversation.setHiddenFor(new ArrayList<>());
        // A reply from the recipient of a stranger request accepts it.
        if (Conversation.STATUS_PENDING.equals(conversation.getStatus())
            && !senderId.equals(conversation.getCreatedBy())) {
            conversation.setStatus(Conversation.STATUS_ACCEPTED);
        }
        conversationRepository.save(conversation);

        return toResponse(message);
    }

    /** Persist a "system" message (e.g. group events) and bump the conversation. */
    public MessageResponse createSystemMessage(String conversationId, String content) {
        Message message = messageRepository.save(Message.builder()
            .conversationId(conversationId)
            .senderId(SYSTEM_SENDER)
            .content(content)
            .type("system")
            .readBy(new ArrayList<>())
            .build());
        conversationRepository.findById(conversationId).ifPresent(conversation -> {
            Instant at = message.getCreatedAt() != null ? message.getCreatedAt() : Instant.now();
            conversation.setLastMessage(Conversation.LastMessage.builder()
                .content(content).senderId(SYSTEM_SENDER).createdAt(at).build());
            conversation.setLastMessageAt(at);
            conversationRepository.save(conversation);
        });
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

    /** Toggle a single reaction per user (Messenger-style): the new emoji
     *  replaces any existing reaction from the same user. */
    public MessageResponse addReaction(String userId, String messageId, String emoji) {
        Message message = requireParticipantMessage(userId, messageId);
        List<Message.Reaction> reactions = message.getReactions() == null
            ? new ArrayList<>() : new ArrayList<>(message.getReactions());
        reactions.removeIf(r -> userId.equals(r.getUserId()));
        reactions.add(Message.Reaction.builder().userId(userId).emoji(emoji).build());
        message.setReactions(reactions);
        return toResponse(messageRepository.save(message));
    }

    public MessageResponse removeReaction(String userId, String messageId) {
        Message message = requireParticipantMessage(userId, messageId);
        if (message.getReactions() != null) {
            List<Message.Reaction> reactions = new ArrayList<>(message.getReactions());
            reactions.removeIf(r -> userId.equals(r.getUserId()));
            message.setReactions(reactions);
            messageRepository.save(message);
        }
        return toResponse(message);
    }

    /** Recall (unsend) for everyone — only the original sender may do this. */
    public MessageResponse recallMessage(String userId, String messageId) {
        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));
        if (!userId.equals(message.getSenderId())) {
            throw new UnauthorizedException("Only the sender can recall this message");
        }
        message.setRecalled(true);
        message.setContent("");
        message.setReactions(new ArrayList<>());
        message.setReplyPreview(null);
        return toResponse(messageRepository.save(message));
    }

    /** Edit a message's content — only the original sender may do this, and
     *  recalled messages cannot be edited. Stamps {@code editedAt}. */
    public MessageResponse editMessage(String userId, String messageId, String newContent) {
        if (newContent == null || newContent.trim().isEmpty()) {
            throw new IllegalArgumentException("Message content cannot be empty");
        }
        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));
        if (!userId.equals(message.getSenderId())) {
            throw new UnauthorizedException("Only the sender can edit this message");
        }
        if (message.isRecalled()) {
            throw new IllegalArgumentException("Cannot edit a recalled message");
        }
        message.setContent(newContent.trim());
        message.setEditedAt(Instant.now());
        return toResponse(messageRepository.save(message));
    }

    /** Hide a message for the requesting user only. */
    public void deleteForMe(String userId, String messageId) {
        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));
        List<String> deletedFor = message.getDeletedFor() == null
            ? new ArrayList<>() : new ArrayList<>(message.getDeletedFor());
        if (!deletedFor.contains(userId)) {
            deletedFor.add(userId);
            message.setDeletedFor(deletedFor);
            messageRepository.save(message);
        }
    }

    /** Background sweep removing messages past each conversation's
     *  disappearing-messages window. */
    @Scheduled(fixedDelayString = "${app.auto-delete.sweep-interval-ms:300000}")
    public void sweepExpiredMessages() {
        List<Conversation> conversations = mongoTemplate.find(
            new Query(Criteria.where("autoDeleteSeconds").gt(0)), Conversation.class);
        for (Conversation conversation : conversations) {
            Integer seconds = conversation.getAutoDeleteSeconds();
            if (seconds == null || seconds <= 0) continue;
            Instant cutoff = Instant.now().minus(seconds, ChronoUnit.SECONDS);
            mongoTemplate.remove(
                new Query(Criteria.where("conversationId").is(conversation.getId())
                    .and("createdAt").lt(cutoff)),
                Message.class);
        }
    }

    /** True if either user has the other in their {@code blockedUsers} list. */
    private boolean isBlockedBetween(String a, String b) {
        return blocks(a, b) || blocks(b, a);
    }

    private boolean blocks(String ownerId, String targetId) {
        return userBlockRepository.findById(ownerId)
            .map(UserBlock::getBlockedUsers)
            .map(list -> list != null && list.contains(targetId))
            .orElse(false);
    }

    private Message requireParticipantMessage(String userId, String messageId) {
        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));
        Conversation conversation = conversationRepository.findById(message.getConversationId())
            .orElseThrow(() -> new ConversationNotFoundException(message.getConversationId()));
        if (!conversation.getParticipants().contains(userId)) {
            throw new UnauthorizedException("Not a participant of this conversation");
        }
        return message;
    }

    private Message.ReplyPreview buildReplyPreview(String replyToId) {
        if (replyToId == null || replyToId.isBlank()) return null;
        return messageRepository.findById(replyToId)
            .map(m -> Message.ReplyPreview.builder()
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

    private MessageResponse toResponse(Message m) {
        List<MessageResponse.ReactionDto> reactions = m.getReactions() == null ? List.of()
            : m.getReactions().stream()
                .map(r -> new MessageResponse.ReactionDto(r.getUserId(), r.getEmoji()))
                .toList();
        MessageResponse.ReplyPreviewDto replyPreview = m.getReplyPreview() == null ? null
            : new MessageResponse.ReplyPreviewDto(
                m.getReplyPreview().getMessageId(),
                m.getReplyPreview().getSenderId(),
                m.getReplyPreview().getContent());
        return new MessageResponse(
            m.getId(), m.getConversationId(), m.getSenderId(),
            m.getContent(), m.getType(), m.getReadBy(), m.getCreatedAt(),
            m.getReplyToId(), replyPreview, reactions, m.isRecalled(), m.getEditedAt()
        );
    }
}
