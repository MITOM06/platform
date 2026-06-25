package com.platform.chatservice.service;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.CreateGroupRequest;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.DuplicateConversationException;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.ExternalBotRepository;
import com.platform.chatservice.repository.FriendshipRepository;
import com.platform.chatservice.repository.MessageRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ConversationService {

  private final ConversationRepository conversationRepository;
  private final ConversationCacheService conversationCacheService;
  private final MessageRepository messageRepository;
  private final FriendshipRepository friendshipRepository;
  private final MongoTemplate mongoTemplate;
  private final ExternalBotRepository externalBotRepository;

  public PageResponse<ConversationResponse> listConversations(String userId, Pageable pageable) {
    return listConversations(userId, pageable, false);
  }

  // Lists the user's conversations. When archived is true only archived
  // conversations are returned; otherwise archived ones are excluded.
  public PageResponse<ConversationResponse> listConversations(
      String userId, Pageable pageable, boolean archived) {
    Page<Conversation> page =
        conversationRepository.findByParticipantsContainingOrderByLastMessageAtDesc(
            userId, pageable);

    List<Conversation> conversations =
        page.getContent().stream()
            .filter(c -> c.getHiddenFor() == null || !c.getHiddenFor().contains(userId))
            .filter(
                c -> {
                  boolean isArchived =
                      c.getArchivedBy() != null && c.getArchivedBy().contains(userId);
                  return archived == isArchived;
                })
            .toList();

    List<String> conversationIds = conversations.stream().map(Conversation::getId).toList();

    Map<String, Long> unreadCounts = getUnreadCounts(conversationIds, userId);

    List<ConversationResponse> content =
        conversations.stream()
            .map(c -> toResponse(c, userId, unreadCounts.getOrDefault(c.getId(), 0L)))
            .toList();

    return new PageResponse<>(content, page.getNumber(), page.getSize(), page.getTotalElements());
  }

  public ConversationResponse createConversation(String currentUserId, String participantId) {
    List<String> participants = List.of(currentUserId, participantId);
    conversationRepository
        .findOneOnOneConversation(participants)
        .ifPresent(
            existing -> {
              throw new DuplicateConversationException(existing.getId());
            });
    // Friends chat freely; a message to a non-friend starts as a stranger
    // request (PENDING) until the recipient accepts or replies. Bot participants
    // (built-in AI or registered, enabled external bots) are always treated as
    // accepted — they never "accept" a request themselves, so a PENDING status
    // would lock bot chat behind a stranger banner.
    boolean friends =
        isBotParticipant(participantId)
            || friendshipRepository.findAcceptedBetween(currentUserId, participantId).isPresent();
    Conversation saved =
        conversationCacheService.save(
            Conversation.builder()
                .participants(participants)
                .type(Conversation.TYPE_DIRECT)
                .createdBy(currentUserId)
                .status(friends ? Conversation.STATUS_ACCEPTED : Conversation.STATUS_PENDING)
                .build());
    return toResponse(saved, currentUserId, 0L);
  }

  public ConversationResponse createGroup(String creatorId, CreateGroupRequest request) {
    if (request.name() == null || request.name().trim().isEmpty()) {
      throw new IllegalArgumentException("Group name cannot be empty");
    }
    // Creator is always a participant + admin; dedupe ids preserving order.
    LinkedHashSet<String> members = new LinkedHashSet<>();
    members.add(creatorId);
    if (request.participantIds() != null) {
      members.addAll(request.participantIds());
    }
    if (members.size() < 2) {
      throw new IllegalArgumentException("A group needs at least 2 members");
    }
    Conversation saved =
        conversationCacheService.save(
            Conversation.builder()
                .type(Conversation.TYPE_GROUP)
                .name(request.name().trim())
                .avatarUrl(request.avatarUrl())
                .participants(new ArrayList<>(members))
                .admins(new ArrayList<>(List.of(creatorId)))
                .createdBy(creatorId)
                .departmentId(request.departmentId())
                .lastMessageAt(Instant.now())
                .build());
    return toResponse(saved, creatorId, 0L);
  }

  public ConversationResponse updateGroup(
      String userId, String conversationId, String name, String avatarUrl) {
    Conversation conversation = requireGroupAdmin(userId, conversationId);
    if (name != null && !name.trim().isEmpty()) {
      conversation.setName(name.trim());
    }
    if (avatarUrl != null) {
      conversation.setAvatarUrl(avatarUrl.isBlank() ? null : avatarUrl);
    }
    Conversation saved = conversationCacheService.save(conversation);
    return toResponse(saved, userId, messageRepository.countUnread(conversationId, userId));
  }

  /**
   * Set the shared conversation wallpaper. Allowed for ANY participant (direct + group) — it is a
   * shared cosmetic, not an admin-gated setting. Blank/null resets to the default for everyone.
   */
  public ConversationResponse setWallpaper(String userId, String conversationId, String wallpaper) {
    Conversation conversation = getRawConversation(userId, conversationId);
    conversation.setWallpaper(wallpaper == null || wallpaper.isBlank() ? null : wallpaper);
    Conversation saved = conversationCacheService.save(conversation);
    return toResponse(saved, userId, messageRepository.countUnread(conversationId, userId));
  }

  public ConversationResponse addMembers(
      String userId, String conversationId, List<String> userIds) {
    Conversation conversation = requireGroupAdmin(userId, conversationId);
    List<String> participants = new ArrayList<>(conversation.getParticipants());
    for (String id : userIds) {
      if (id != null && !participants.contains(id)) {
        participants.add(id);
      }
    }
    conversation.setParticipants(participants);
    Conversation saved = conversationCacheService.save(conversation);
    return toResponse(saved, userId, messageRepository.countUnread(conversationId, userId));
  }

  /**
   * Remove a member. Self-removal (leave) is allowed for any participant; removing others requires
   * admin.
   */
  public ConversationResponse removeMember(
      String userId, String conversationId, String targetUserId) {
    Conversation conversation = getRawConversation(userId, conversationId);
    if (!conversation.isGroup()) {
      throw new IllegalArgumentException("Not a group conversation");
    }
    boolean isSelf = userId.equals(targetUserId);
    if (!isSelf && !isAdmin(conversation, userId)) {
      throw new ForbiddenException("Only admins can remove members");
    }
    List<String> participants = new ArrayList<>(conversation.getParticipants());
    participants.remove(targetUserId);
    conversation.setParticipants(participants);
    if (conversation.getAdmins() != null) {
      List<String> admins = new ArrayList<>(conversation.getAdmins());
      admins.remove(targetUserId);
      // Promote someone if the group lost all admins but still has members.
      if (admins.isEmpty() && !participants.isEmpty()) {
        admins.add(participants.get(0));
      }
      conversation.setAdmins(admins);
    }
    Conversation saved = conversationCacheService.save(conversation);
    return toResponse(saved, userId, 0L);
  }

  /** Hide the conversation from the user's list and clear their history cutoff. */
  public void deleteConversation(String userId, String conversationId) {
    Conversation conversation = getRawConversation(userId, conversationId);
    List<String> hidden =
        conversation.getHiddenFor() == null
            ? new ArrayList<>()
            : new ArrayList<>(conversation.getHiddenFor());
    if (!hidden.contains(userId)) {
      hidden.add(userId);
    }
    conversation.setHiddenFor(hidden);
    setClearedAt(conversation, userId, Instant.now());
    conversationCacheService.save(conversation);
  }

  /** "Start over": hide all messages up to now for this user only. */
  public void clearHistory(String userId, String conversationId) {
    Conversation conversation = getRawConversation(userId, conversationId);
    setClearedAt(conversation, userId, Instant.now());
    conversationCacheService.save(conversation);
  }

  public ConversationResponse muteConversation(String userId, String conversationId) {
    Conversation conversation = getRawConversation(userId, conversationId);
    List<String> muted =
        conversation.getMutedUsers() == null
            ? new ArrayList<>()
            : new ArrayList<>(conversation.getMutedUsers());
    if (!muted.contains(userId)) {
      muted.add(userId);
      conversation.setMutedUsers(muted);
      conversationCacheService.save(conversation);
    }
    return toResponse(conversation, userId, messageRepository.countUnread(conversationId, userId));
  }

  public ConversationResponse unmuteConversation(String userId, String conversationId) {
    Conversation conversation = getRawConversation(userId, conversationId);
    List<String> muted =
        conversation.getMutedUsers() == null
            ? new ArrayList<>()
            : new ArrayList<>(conversation.getMutedUsers());
    if (muted.remove(userId)) {
      conversation.setMutedUsers(muted);
      conversationCacheService.save(conversation);
    }
    return toResponse(conversation, userId, messageRepository.countUnread(conversationId, userId));
  }

  public ConversationResponse archiveConversation(String userId, String conversationId) {
    Conversation conversation = getRawConversation(userId, conversationId);
    List<String> archived =
        conversation.getArchivedBy() == null
            ? new ArrayList<>()
            : new ArrayList<>(conversation.getArchivedBy());
    if (!archived.contains(userId)) {
      archived.add(userId);
      conversation.setArchivedBy(archived);
      conversationCacheService.save(conversation);
    }
    return toResponse(conversation, userId, messageRepository.countUnread(conversationId, userId));
  }

  public ConversationResponse unarchiveConversation(String userId, String conversationId) {
    Conversation conversation = getRawConversation(userId, conversationId);
    List<String> archived =
        conversation.getArchivedBy() == null
            ? new ArrayList<>()
            : new ArrayList<>(conversation.getArchivedBy());
    if (archived.remove(userId)) {
      conversation.setArchivedBy(archived);
      conversationCacheService.save(conversation);
    }
    return toResponse(conversation, userId, messageRepository.countUnread(conversationId, userId));
  }

  public ConversationResponse markConversationUnread(String userId, String conversationId) {
    Conversation conversation = getRawConversation(userId, conversationId);
    Pageable pageable = PageRequest.of(0, 1, Sort.by(Sort.Direction.DESC, "createdAt"));
    Page<Message> page =
        messageRepository.findByConversationIdOrderByCreatedAtDesc(conversationId, pageable);
    if (!page.isEmpty()) {
      Message lastMessage = page.getContent().get(0);
      List<String> readBy =
          lastMessage.getReadBy() == null
              ? new ArrayList<>()
              : new ArrayList<>(lastMessage.getReadBy());
      if (readBy.remove(userId)) {
        lastMessage.setReadBy(readBy);
        messageRepository.save(lastMessage);
      }
    }
    return toResponse(conversation, userId, messageRepository.countUnread(conversationId, userId));
  }

  public ConversationResponse markConversationRead(String userId, String conversationId) {
    Conversation conversation = getRawConversation(userId, conversationId);
    // Atomic per-document $addToSet avoids the read-modify-write race where a
    // message arriving mid-operation could be silently re-marked unread, and
    // avoids loading the whole unread set into memory.
    mongoTemplate.updateMulti(
        new Query(Criteria.where("conversationId").is(conversationId).and("readBy").nin(userId)),
        new Update().addToSet("readBy", userId),
        Message.class);
    return toResponse(conversation, userId, 0L);
  }

  public ConversationResponse setAutoDelete(String userId, String conversationId, Integer seconds) {
    Conversation conversation = getRawConversation(userId, conversationId);
    conversation.setAutoDeleteSeconds(seconds != null && seconds > 0 ? seconds : null);
    Conversation saved = conversationCacheService.save(conversation);
    return toResponse(saved, userId, messageRepository.countUnread(conversationId, userId));
  }

  public ConversationResponse getConversation(String userId, String conversationId) {
    Conversation conversation = getRawConversation(userId, conversationId);
    long unreadCount = messageRepository.countUnread(conversationId, userId);
    return toResponse(conversation, userId, unreadCount);
  }

  /**
   * Accept a pending stranger request. Only a participant who did NOT initiate the conversation may
   * accept it.
   */
  public ConversationResponse acceptConversation(String userId, String conversationId) {
    Conversation conversation = getRawConversation(userId, conversationId);
    if (userId.equals(conversation.getCreatedBy())) {
      throw new ForbiddenException("The initiator cannot accept their own request");
    }
    conversation.setStatus(Conversation.STATUS_ACCEPTED);
    Conversation saved = conversationCacheService.save(conversation);
    return toResponse(saved, userId, messageRepository.countUnread(conversationId, userId));
  }

  private Map<String, Long> getUnreadCounts(List<String> conversationIds, String userId) {
    if (conversationIds.isEmpty()) {
      return Map.of();
    }

    Aggregation aggregation =
        Aggregation.newAggregation(
            Aggregation.match(
                Criteria.where("conversationId").in(conversationIds).and("readBy").nin(userId)),
            Aggregation.group("conversationId").count().as("count"));

    List<Document> results =
        mongoTemplate.aggregate(aggregation, "messages", Document.class).getMappedResults();

    return results.stream()
        .collect(
            Collectors.toMap(
                doc -> doc.get("_id", String.class),
                doc -> ((Number) doc.get("count")).longValue()));
  }

  /** List public group channels visible to everyone, optionally filtered by name. */
  public PageResponse<ConversationResponse> listPublicChannels(String query, Pageable pageable) {
    Page<Conversation> page =
        (query != null && !query.isBlank())
            ? conversationRepository.findPublicGroupsByName(query.trim(), pageable)
            : conversationRepository.findPublicGroups(pageable);
    List<ConversationResponse> content =
        page.getContent().stream().map(c -> toResponse(c, null, 0L)).toList();
    return new PageResponse<>(content, page.getNumber(), page.getSize(), page.getTotalElements());
  }

  /** Join a public channel. Idempotent — no-op if the user is already a member. */
  public ConversationResponse joinChannel(String userId, String conversationId) {
    Conversation conversation =
        conversationCacheService
            .findByIdOptional(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
    if (!conversation.isPublicChannel()
        || !Conversation.TYPE_GROUP.equals(conversation.getType())) {
      throw new ForbiddenException("This channel is not publicly joinable");
    }
    if (!conversation.getParticipants().contains(userId)) {
      List<String> participants = new ArrayList<>(conversation.getParticipants());
      participants.add(userId);
      conversation.setParticipants(participants);
      conversationCacheService.save(conversation);
    }
    return toResponse(conversation, userId, messageRepository.countUnread(conversationId, userId));
  }

  public List<String> getParticipants(String conversationId) {
    return conversationCacheService
        .findByIdOptional(conversationId)
        .map(Conversation::getParticipants)
        .orElse(List.of());
  }

  public boolean isMuted(String conversationId, String userId) {
    return conversationCacheService
        .findByIdOptional(conversationId)
        .map(Conversation::getMutedUsers)
        .map(list -> list != null && list.contains(userId))
        .orElse(false);
  }

  /** Fetch a conversation, enforcing the caller is a participant. */
  private Conversation getRawConversation(String userId, String conversationId) {
    Conversation conversation =
        conversationCacheService
            .findByIdOptional(conversationId)
            .orElseThrow(() -> new ConversationNotFoundException(conversationId));
    if (conversation.getParticipants() == null
        || !conversation.getParticipants().contains(userId)) {
      throw new ConversationNotFoundException(conversationId);
    }
    return conversation;
  }

  private Conversation requireGroupAdmin(String userId, String conversationId) {
    Conversation conversation = getRawConversation(userId, conversationId);
    if (!conversation.isGroup()) {
      throw new IllegalArgumentException("Not a group conversation");
    }
    if (!isAdmin(conversation, userId)) {
      throw new ForbiddenException("Only admins can perform this action");
    }
    return conversation;
  }

  private boolean isAdmin(Conversation conversation, String userId) {
    return conversation.getAdmins() != null && conversation.getAdmins().contains(userId);
  }

  /** A bot participant (built-in AI or a registered, enabled external bot) is always accepted. */
  private boolean isBotParticipant(String participantId) {
    if (AiConstants.AI_BOT_USER_ID.equals(participantId)) {
      return true;
    }
    return externalBotRepository
        .findByBotUserId(participantId)
        .map(ExternalBot::isEnabled)
        .orElse(false);
  }

  private void setClearedAt(Conversation conversation, String userId, Instant when) {
    Map<String, Instant> cleared =
        conversation.getClearedAt() == null
            ? new java.util.HashMap<>()
            : new java.util.HashMap<>(conversation.getClearedAt());
    cleared.put(userId, when);
    conversation.setClearedAt(cleared);
  }

  private ConversationResponse toResponse(Conversation c, String userId, long unreadCount) {
    ConversationResponse.LastMessageDto lastMsg = null;
    if (c.getLastMessage() != null) {
      lastMsg =
          new ConversationResponse.LastMessageDto(
              c.getLastMessage().getContent(),
              c.getLastMessage().getSenderId(),
              c.getLastMessage().getCreatedAt());
    }
    List<ConversationResponse.PinnedMessageDto> pinned = resolvePinnedMessages(c);
    boolean isMuted =
        userId != null && c.getMutedUsers() != null && c.getMutedUsers().contains(userId);
    boolean isArchived =
        userId != null && c.getArchivedBy() != null && c.getArchivedBy().contains(userId);
    return new ConversationResponse(
        c.getId(),
        c.resolvedType(),
        c.getName(),
        c.getAvatarUrl(),
        c.getParticipants(),
        c.getAdmins(),
        c.getCreatedBy(),
        c.getAutoDeleteSeconds(),
        lastMsg,
        c.getLastMessageAt(),
        unreadCount,
        c.getCreatedAt(),
        c.resolvedStatus(),
        c.isPublicChannel(),
        pinned,
        isMuted,
        isArchived,
        c.getWallpaper());
  }

  private List<ConversationResponse.PinnedMessageDto> resolvePinnedMessages(Conversation c) {
    if (c.getPinnedMessages() == null || c.getPinnedMessages().isEmpty()) {
      return List.of();
    }
    // Clamp to the same max as the pin write-path (MessageService.MAX_PINNED_MESSAGES).
    List<String> ids = c.getPinnedMessages();
    if (ids.size() > MessageService.MAX_PINNED_MESSAGES) {
      ids = ids.subList(0, MessageService.MAX_PINNED_MESSAGES);
    }
    return ids.stream()
        .map(messageId -> messageRepository.findById(messageId).orElse(null))
        .filter(m -> m != null && !m.isRecalled())
        .map(
            m ->
                new ConversationResponse.PinnedMessageDto(
                    m.getId(), m.getSenderId(), m.getContent(), m.getCreatedAt()))
        .toList();
  }
}
