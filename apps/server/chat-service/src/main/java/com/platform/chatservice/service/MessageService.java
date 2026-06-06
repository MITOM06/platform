package com.platform.chatservice.service;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.PinResult;
import com.platform.chatservice.dto.SendMessageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.MessageNotFoundException;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MessageRepository;
import com.mongodb.client.result.UpdateResult;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class MessageService {

    private static final String SYSTEM_SENDER = "system";

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final MongoTemplate mongoTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final MessageServiceHelper helper;

    /**
     * Cursor-based pagination (newest first). When {@code beforeId} is null/blank
     * the most recent page is returned; otherwise only messages strictly older
     * than that message are returned. This keeps the scroll stable and avoids the
     * duplication/jumping that offset paging suffers when new messages arrive.
     *
     * <p>We over-fetch one row ({@code size + 1}) to detect whether more history
     * exists, then encode that into {@link PageResponse#hasNext()} via a synthetic
     * {@code totalElements}.
     */
    public PageResponse<MessageResponse> getMessages(
            String userId, String conversationId, String beforeId, int size) {
        Conversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
        if (!conversation.getParticipants().contains(userId)) {
            throw new ConversationNotFoundException(conversationId);
        }
        Instant clearedAt = conversation.getClearedAt() == null ? null
            : conversation.getClearedAt().get(userId);

        int pageSize = size <= 0 ? 20 : size;
        Pageable pageable = PageRequest.of(0, pageSize + 1, Sort.by(Sort.Direction.DESC, "createdAt"));

        List<Message> rows;
        Instant cursor = (beforeId == null || beforeId.isBlank()) ? null
            : messageRepository.findById(beforeId).map(Message::getCreatedAt).orElse(null);
        if (cursor != null) {
            rows = messageRepository.findByConversationIdAndCreatedAtLessThanOrderByCreatedAtDesc(
                conversationId, cursor, pageable);
        } else {
            rows = messageRepository
                .findByConversationIdOrderByCreatedAtDesc(conversationId, pageable)
                .getContent();
        }

        boolean hasMore = rows.size() > pageSize;
        List<Message> pageRows = hasMore ? rows.subList(0, pageSize) : rows;
        List<MessageResponse> content = pageRows.stream()
            .filter(m -> m.getDeletedFor() == null || !m.getDeletedFor().contains(userId))
            .filter(m -> clearedAt == null || m.getCreatedAt() == null || m.getCreatedAt().isAfter(clearedAt))
            .map(this::toResponse)
            .toList();

        // page=0 always; totalElements is synthetic so hasNext() reflects `hasMore`.
        long total = hasMore ? (long) pageSize + 1 : content.size();
        return new PageResponse<>(content, 0, pageSize, total);
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
            if (!participant.equals(senderId) && helper.isBlockedBetween(senderId, participant)) {
                throw new ForbiddenException("Cannot send message: user is blocked");
            }
        }

        Message.ReplyPreview replyPreview = helper.buildReplyPreview(request.replyToId());
        List<String> mentions = helper.parseMentions(
            request.content(), conversation.getParticipants(), senderId);

        Message message = messageRepository.save(Message.builder()
            .conversationId(request.conversationId())
            .senderId(senderId)
            .content(request.content())
            .type(request.type() != null ? request.type() : "text")
            .readBy(new ArrayList<>(List.of(senderId)))
            .replyToId(request.replyToId())
            .replyPreview(replyPreview)
            .mentions(mentions)
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
        Message message = helper.requireParticipantMessage(userId, messageId);
        List<Message.Reaction> reactions = message.getReactions() == null
            ? new ArrayList<>() : new ArrayList<>(message.getReactions());
        reactions.removeIf(r -> userId.equals(r.getUserId()));
        reactions.add(Message.Reaction.builder().userId(userId).emoji(emoji).build());
        message.setReactions(reactions);
        return toResponse(messageRepository.save(message));
    }

    public MessageResponse removeReaction(String userId, String messageId) {
        Message message = helper.requireParticipantMessage(userId, messageId);
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
            throw new ForbiddenException("Only the sender can recall this message");
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
            throw new ForbiddenException("Only the sender can edit this message");
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

    /**
     * Pin a message in its conversation (Task 53). Any participant may pin in
     * a direct chat; group chats require admin rights. Keeps at most 5 pins,
     * newest first. Returns the updated conversation so the client can refresh
     * the pinned-message header.
     */
    public PinResult pinMessage(String userId, String messageId) {
        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));
        Conversation conversation = conversationRepository.findById(message.getConversationId())
            .orElseThrow(() -> new ConversationNotFoundException(message.getConversationId()));
        if (!conversation.getParticipants().contains(userId)) {
            throw new ForbiddenException("Not a participant of this conversation");
        }
        if (message.isRecalled()) {
            throw new IllegalArgumentException("Cannot pin a recalled message");
        }
        if (conversation.isGroup()) {
            boolean isAdmin = conversation.getAdmins() != null
                && conversation.getAdmins().contains(userId);
            if (!isAdmin) {
                throw new ForbiddenException("Only admins can pin messages in a group");
            }
        }
        List<String> pinned = conversation.getPinnedMessages() == null
            ? new ArrayList<>() : new ArrayList<>(conversation.getPinnedMessages());
        pinned.remove(messageId);
        pinned.add(0, messageId);
        if (pinned.size() > 5) {
            pinned = pinned.subList(0, 5);
        }
        conversation.setPinnedMessages(pinned);
        conversationRepository.save(conversation);
        return new PinResult(conversation.getId(), pinned);
    }

    /** Unpin a message. Same permission rules as pinMessage. */
    public PinResult unpinMessage(String userId, String messageId) {
        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));
        Conversation conversation = conversationRepository.findById(message.getConversationId())
            .orElseThrow(() -> new ConversationNotFoundException(message.getConversationId()));
        if (!conversation.getParticipants().contains(userId)) {
            throw new ForbiddenException("Not a participant of this conversation");
        }
        if (conversation.isGroup()) {
            boolean isAdmin = conversation.getAdmins() != null
                && conversation.getAdmins().contains(userId);
            if (!isAdmin) {
                throw new ForbiddenException("Only admins can unpin messages in a group");
            }
        }
        List<String> pinned = conversation.getPinnedMessages() == null
            ? new ArrayList<>() : new ArrayList<>(conversation.getPinnedMessages());
        pinned.remove(messageId);
        conversation.setPinnedMessages(pinned);
        conversationRepository.save(conversation);
        return new PinResult(conversation.getId(), pinned);
    }

    /**
     * Forward a message to a target conversation (Task 53). Creates a copy of
     * the original content in the target conversation as a new message from the
     * forwarding user.
     */
    public MessageResponse forwardMessage(String userId, String messageId, String targetConversationId) {
        Message original = messageRepository.findById(messageId)
            .orElseThrow(() -> new MessageNotFoundException(messageId));
        if (original.isRecalled()) {
            throw new IllegalArgumentException("Cannot forward a recalled message");
        }
        Conversation srcConv = conversationRepository.findById(original.getConversationId())
            .orElseThrow(() -> new ConversationNotFoundException(original.getConversationId()));
        if (!srcConv.getParticipants().contains(userId)) {
            throw new ForbiddenException("Not a participant of source conversation");
        }
        return sendMessage(userId, new SendMessageRequest(
            targetConversationId, original.getContent(), original.getType(), null));
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

    MessageResponse toResponse(Message m) {
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
            m.getReplyToId(), replyPreview, reactions, m.isRecalled(), m.getEditedAt(),
            m.getMentions() == null ? List.of() : m.getMentions()
        );
    }

    /**
     * Catch-up fetch for Task 55 — returns messages with createdAt > afterTimestamp,
     * oldest first, capped at 50. Called on STOMP reconnect so the client can sync
     * any messages that arrived while it was offline.
     */
    public List<MessageResponse> getMessagesSince(
            String userId, String conversationId, Instant afterTimestamp) {
        Conversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
        if (!conversation.getParticipants().contains(userId)) {
            throw new ConversationNotFoundException(conversationId);
        }
        Instant clearedAt = conversation.getClearedAt() == null ? null
            : conversation.getClearedAt().get(userId);

        Pageable pageable = PageRequest.of(0, 50, Sort.by(Sort.Direction.ASC, "createdAt"));
        List<Message> rows =
            messageRepository.findByConversationIdAndCreatedAtGreaterThanOrderByCreatedAtAsc(
                conversationId, afterTimestamp, pageable);

        return rows.stream()
            .filter(m -> m.getDeletedFor() == null || !m.getDeletedFor().contains(userId))
            .filter(m -> clearedAt == null || m.getCreatedAt() == null
                || m.getCreatedAt().isAfter(clearedAt))
            .map(this::toResponse)
            .toList();
    }

    /**
     * Save an AI-generated message and broadcast it to the conversation topic.
     * Called by AiResponseListener when AI_STREAM_DONE is received from Redis.
     */
    public MessageResponse saveAiMessage(String conversationId, String content) {
        Message message = messageRepository.save(Message.builder()
            .conversationId(conversationId)
            .senderId(AiConstants.AI_BOT_USER_ID)
            .content(content)
            .type("ai")
            .readBy(new ArrayList<>())
            .build());

        Instant savedAt = message.getCreatedAt() != null ? message.getCreatedAt() : Instant.now();
        conversationRepository.findById(conversationId).ifPresent(conv -> {
            conv.setLastMessage(Conversation.LastMessage.builder()
                .content(content)
                .senderId(AiConstants.AI_BOT_USER_ID)
                .createdAt(savedAt)
                .build());
            conv.setLastMessageAt(savedAt);
            conversationRepository.save(conv);
        });

        MessageResponse response = toResponse(message);
        messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, response);
        return response;
    }

    /**
     * Fetch the last {@code limit} non-recalled messages in chronological order
     * for building AI conversation history. Returns an empty list on any error
     * so AI request failure never disrupts the main send flow.
     */
    private static final Set<String> AI_HISTORY_SKIP_TYPES =
        Set.of("voice", "file", "sticker", "system", "call_log");
    private static final Pattern AI_MENTION_STRIP =
        Pattern.compile("(?i)@(AI|ponai)\\b");

    public List<Map<String, String>> getAiHistory(String userId, String conversationId) {
        try {
            PageResponse<MessageResponse> paged = getMessages(userId, conversationId, null, 20);
            List<Map<String, String>> history = new ArrayList<>();
            for (MessageResponse msg : paged.content()) {
                if (msg.recalled() || msg.content() == null || msg.content().isBlank()) continue;
                if (AI_HISTORY_SKIP_TYPES.contains(msg.type())) continue;
                String role = AiConstants.AI_BOT_USER_ID.equals(msg.senderId()) ? "assistant" : "user";
                String content = AI_MENTION_STRIP.matcher(msg.content()).replaceAll("").trim();
                if (content.isBlank()) continue;
                history.add(Map.of("role", role, "content", content));
            }
            Collections.reverse(history); // newest-first → chronological
            return history;
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * Conversation-scoped message search (Task 50). Case-insensitive substring
     * match on {@code content}, newest first, excluding recalled messages,
     * messages the user deleted for themselves, and history before their
     * clear-cutoff. Caller must be a participant.
     */
    public List<MessageResponse> searchMessages(String userId, String conversationId, String query) {
        Conversation conversation = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
        if (!conversation.getParticipants().contains(userId)) {
            throw new ConversationNotFoundException(conversationId);
        }
        if (query == null || query.trim().isEmpty()) {
            return List.of();
        }
        Instant clearedAt = conversation.getClearedAt() == null ? null
            : conversation.getClearedAt().get(userId);

        String escaped = java.util.regex.Pattern.quote(query.trim());
        Query q = new Query(Criteria.where("conversationId").is(conversationId)
                .and("recalled").ne(true)
                .and("content").regex(escaped, "i"))
            .with(Sort.by(Sort.Direction.DESC, "createdAt"))
            .limit(50);
        List<Message> rows = mongoTemplate.find(q, Message.class);

        return rows.stream()
            .filter(m -> m.getDeletedFor() == null || !m.getDeletedFor().contains(userId))
            .filter(m -> clearedAt == null || m.getCreatedAt() == null || m.getCreatedAt().isAfter(clearedAt))
            .map(this::toResponse)
            .toList();
    }
}
