package com.platform.chatservice.service;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.CreateGroupRequest;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Write-side of the conversation domain: creation, group management, membership, per-user state
 * (mute/archive/block/read), wallpaper, auto-delete and stranger-request acceptance. Read/list
 * concerns live in {@link ConversationQueryService}; response mapping lives in {@link
 * ConversationMapper}.
 */
@Service
@RequiredArgsConstructor
public class ConversationService {

  private final ConversationRepository conversationRepository;
  private final ConversationCacheService conversationCacheService;
  private final MessageRepository messageRepository;
  private final FriendshipRepository friendshipRepository;
  private final MongoTemplate mongoTemplate;
  private final ExternalBotRepository externalBotRepository;
  private final ConversationMapper conversationMapper;

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
    List<String> pendingMembers = new ArrayList<>(members);
    pendingMembers.remove(creatorId);
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
                .pendingMembers(pendingMembers)
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
    // Snapshot existing participants BEFORE mutating, so an already-accepted member
    // re-passed in userIds is not wrongly demoted back to pending.
    Set<String> alreadyIn = new HashSet<>(conversation.getParticipants());
    List<String> participants = new ArrayList<>(conversation.getParticipants());
    for (String id : userIds) {
      if (id != null && !participants.contains(id)) {
        participants.add(id);
      }
    }
    conversation.setParticipants(participants);
    if (conversation.getPendingMembers() == null) conversation.setPendingMembers(new ArrayList<>());
    for (String id : userIds) {
      if (id != null
          && !alreadyIn.contains(id)
          && !conversation.getPendingMembers().contains(id)
          && !id.equals(conversation.getCreatedBy())) {
        conversation.getPendingMembers().add(id);
      }
    }
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
    if (conversation.getPendingMembers() != null) {
      conversation.getPendingMembers().remove(targetUserId);
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

  /** Sentinel value meaning "muted until the user manually unmutes". */
  private static final long MUTE_FOREVER_MS = 9_200_000_000_000_000L;

  /**
   * Mute conversation for userId with a time-based duration.
   *
   * @param durationSeconds 900=15min, 1800=30min, 3600=1h, 86400=24h, -1=forever
   */
  public ConversationResponse muteConversation(
      String userId, String conversationId, long durationSeconds) {
    Conversation conversation = getRawConversation(userId, conversationId);
    if (conversation.getMutedUntil() == null) {
      conversation.setMutedUntil(new HashMap<>());
    }
    long expiryMs =
        (durationSeconds <= 0)
            ? MUTE_FOREVER_MS
            : System.currentTimeMillis() + durationSeconds * 1000L;
    conversation.getMutedUntil().put(userId, expiryMs);
    conversationCacheService.save(conversation);
    return toResponse(conversation, userId, messageRepository.countUnread(conversationId, userId));
  }

  public ConversationResponse unmuteConversation(String userId, String conversationId) {
    Conversation conversation = getRawConversation(userId, conversationId);
    if (conversation.getMutedUntil() != null) {
      conversation.getMutedUntil().remove(userId);
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
      // Atomic $pull mirrors markConversationRead's $addToSet: avoids the read-modify-write race
      // where a concurrent read could silently re-add the user to readBy.
      mongoTemplate.updateFirst(
          new Query(Criteria.where("_id").is(lastMessage.getId())),
          new Update().pull("readBy", userId),
          Message.class);
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
    if (Conversation.TYPE_DIRECT.equals(conversation.resolvedType())) {
      if (userId.equals(conversation.getCreatedBy())) {
        throw new ForbiddenException("The initiator cannot accept their own request");
      }
      conversation.setStatus(Conversation.STATUS_ACCEPTED);
    } else {
      if (conversation.getPendingMembers() != null) {
        conversation.getPendingMembers().remove(userId);
      }
    }
    Conversation saved = conversationCacheService.save(conversation);
    return toResponse(saved, userId, messageRepository.countUnread(conversationId, userId));
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

  /** Move conversation to the Blocked section for userId (called after blockUser). */
  public ConversationResponse blockArchiveConversation(String userId, String conversationId) {
    Conversation conv = getRawConversation(userId, conversationId);
    if (conv.getBlockedBy() == null) {
      conv.setBlockedBy(new ArrayList<>());
    }
    if (!conv.getBlockedBy().contains(userId)) {
      conv.getBlockedBy().add(userId);
      conversationCacheService.save(conv);
    }
    return toResponse(conv, userId, messageRepository.countUnread(conversationId, userId));
  }

  /** Restore conversation from Blocked section (called after unblockUser). */
  public ConversationResponse blockRestoreConversation(String userId, String conversationId) {
    Conversation conv = getRawConversation(userId, conversationId);
    if (conv.getBlockedBy() != null && conv.getBlockedBy().remove(userId)) {
      conversationCacheService.save(conv);
    }
    return toResponse(conv, userId, messageRepository.countUnread(conversationId, userId));
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

  /**
   * True iff {@code conversationId} is a 1-1 (exactly 2 participants) with the native AI bot as the
   * other participant — i.e. every message here is implicitly "to the AI", so no {@code @AI}
   * mention is needed to trigger a reply. Group chats (and 1-1s between two humans) still require
   * an explicit mention.
   */
  public boolean isDirectAiConversation(String conversationId) {
    return conversationCacheService
        .findByIdOptional(conversationId)
        .map(Conversation::getParticipants)
        .map(p -> p.size() == 2 && p.contains(AiConstants.AI_BOT_USER_ID))
        .orElse(false);
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
    return conversationMapper.toResponse(c, userId, unreadCount);
  }
}
