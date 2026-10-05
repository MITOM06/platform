package com.platform.chatservice.service;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.CreateGroupRequest;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ConversationNotFoundException;
import com.platform.chatservice.exception.DuplicateConversationException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.ForbiddenException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.ExternalBot;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.ExternalBotRepository;
import com.platform.chatservice.repository.FriendshipRepository;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Write-side of the conversation domain for SHARED state: creation, group management, membership,
 * wallpaper, auto-delete and stranger-request acceptance. Per-user state (mute/archive/block/read/
 * clear/hide) lives in {@link ConversationUserStateService}; read/list concerns in {@link
 * ConversationQueryService}; response mapping in {@link ConversationMapper}.
 */
@Service
@RequiredArgsConstructor
public class ConversationService {

  private final ConversationRepository conversationRepository;
  private final ConversationCacheService conversationCacheService;
  private final FriendshipRepository friendshipRepository;
  private final ExternalBotRepository externalBotRepository;
  private final ConversationWriteSupport support;
  private final ConversationMembershipCache membershipCache;

  /** Result of {@link #setAutoDelete}: {@code changed} is false for a no-op (same setting). */
  public record AutoDeleteChange(ConversationResponse conversation, boolean changed, int seconds) {}

  public ConversationResponse createConversation(String currentUserId, String participantId) {
    List<String> participants = List.of(currentUserId, participantId);
    conversationRepository.findOneOnOneConversations(participants).stream()
        .findFirst()
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
    return support.view(saved, currentUserId, 0L);
  }

  public ConversationResponse createGroup(UserPrincipal creator, CreateGroupRequest request) {
    if (request.name() == null || request.name().trim().isEmpty()) {
      throw new IllegalArgumentException("Group name cannot be empty");
    }
    requireDepartmentAccess(creator, request.departmentId());
    boolean publicChannel = Boolean.TRUE.equals(request.publicChannel());
    if (publicChannel) {
      requireNotDepartmentGroup(request.departmentId());
    }
    final String creatorId = creator.getUserId();
    // Creator is always a participant + admin; dedupe ids preserving order.
    LinkedHashSet<String> members = new LinkedHashSet<>();
    members.add(creatorId);
    if (request.participantIds() != null) {
      request.participantIds().stream().filter(Objects::nonNull).forEach(members::add);
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
                .publicChannel(publicChannel)
                .lastMessageAt(Instant.now())
                .pendingMembers(pendingMembers)
                .build());
    return support.view(saved, creatorId, 0L);
  }

  /**
   * A group's departmentId scopes its AI bot to that department's knowledge base (ai-service
   * searches every document with the same departmentId). Taking it from the request unchecked let
   * any member open a group "in" another department and read that department's documents through
   * the assistant — so only a member of the department, or someone who manages departments, may
   * attach one.
   */
  static void requireDepartmentAccess(UserPrincipal creator, String departmentId) {
    if (departmentId == null || departmentId.isBlank()) return;
    if (creator.inDepartment(departmentId) || creator.hasPermission("MANAGE_DEPARTMENTS")) return;
    throw new ForbiddenException("Not a member of this department");
  }

  /**
   * A department group scopes its assistant to that department's knowledge base; making it public
   * would let anyone join and read that knowledge base through the assistant — the exact leak
   * {@link #requireDepartmentAccess} closes at creation.
   */
  private static void requireNotDepartmentGroup(String departmentId) {
    if (departmentId != null && !departmentId.isBlank()) {
      throw new BadRequestException(
          ErrorCodes.PUBLIC_DEPARTMENT_CHANNEL_NOT_ALLOWED,
          "A department group cannot be a public channel");
    }
  }

  public ConversationResponse updateGroup(
      String userId, String conversationId, String name, String avatarUrl) {
    return updateGroup(userId, conversationId, name, avatarUrl, null);
  }

  /** Same, optionally switching the group between public channel and private ({@code null}). */
  public ConversationResponse updateGroup(
      String userId, String conversationId, String name, String avatarUrl, Boolean publicChannel) {
    Conversation conversation = support.requireGroupAdmin(userId, conversationId);
    Update update = new Update();
    boolean touched = false;
    if (publicChannel != null && publicChannel != conversation.isPublicChannel()) {
      if (publicChannel) {
        requireNotDepartmentGroup(conversation.getDepartmentId());
      }
      update.set("publicChannel", publicChannel);
      touched = true;
    }
    if (name != null && !name.trim().isEmpty()) {
      update.set("name", name.trim());
      touched = true;
    }
    if (avatarUrl != null) {
      if (avatarUrl.isBlank()) {
        update.unset("avatarUrl");
      } else {
        update.set("avatarUrl", avatarUrl);
      }
      touched = true;
    }
    Conversation result = touched ? support.update(conversationId, null, update) : conversation;
    return support.view(result != null ? result : conversation, userId);
  }

  /**
   * Set the shared conversation wallpaper. Allowed for ANY participant (direct + group) — it is a
   * shared cosmetic, not an admin-gated setting. Blank/null resets to the default for everyone.
   */
  public ConversationResponse setWallpaper(String userId, String conversationId, String wallpaper) {
    Update update =
        wallpaper == null || wallpaper.isBlank()
            ? new Update().unset("wallpaper")
            : new Update().set("wallpaper", wallpaper);
    return support.view(support.updateAsParticipant(userId, conversationId, update), userId);
  }

  public ConversationResponse addMembers(
      String userId, String conversationId, List<String> userIds) {
    Conversation conversation = support.requireGroupAdmin(userId, conversationId);
    // Snapshot existing participants BEFORE mutating, so an already-accepted member
    // re-passed in userIds is not wrongly demoted back to pending.
    Set<String> alreadyIn = new HashSet<>(conversation.getParticipants());
    List<String> newMembers =
        (userIds == null ? List.<String>of() : userIds)
            .stream()
                .filter(id -> id != null && !id.isBlank() && !alreadyIn.contains(id))
                .distinct()
                .toList();
    if (newMembers.isEmpty()) {
      return support.view(conversation, userId);
    }
    List<String> newPending =
        newMembers.stream().filter(id -> !id.equals(conversation.getCreatedBy())).toList();
    Update update = new Update();
    update.addToSet("participants").each(newMembers.toArray());
    if (!newPending.isEmpty()) {
      update.addToSet("pendingMembers").each(newPending.toArray());
    }
    Conversation updated = support.update(conversationId, null, update);
    membershipCache.invalidate(conversationId);
    return support.view(updated != null ? updated : conversation, userId);
  }

  /**
   * Remove a member. Self-removal (leave) is allowed for any participant; removing others requires
   * admin. If the group is left without an admin, the first remaining human member is promoted.
   */
  public ConversationResponse removeMember(
      String userId, String conversationId, String targetUserId) {
    Conversation conversation = support.requireParticipant(userId, conversationId);
    if (!conversation.isGroup()) {
      throw ConversationWriteSupport.notAGroup();
    }
    boolean isSelf = userId.equals(targetUserId);
    if (!isSelf && !ConversationWriteSupport.isAdmin(conversation, userId)) {
      throw ConversationWriteSupport.adminRequired("Only admins can remove members");
    }
    Conversation updated =
        support.update(
            conversationId,
            null,
            new Update()
                .pull("participants", targetUserId)
                .pull("admins", targetUserId)
                .pull("pendingMembers", targetUserId));
    membershipCache.invalidate(conversationId);
    if (updated == null) {
      throw new ConversationNotFoundException(conversationId);
    }
    updated = promoteHeirIfNoAdmin(conversationId, updated);
    return support.view(updated, userId, 0L);
  }

  /** Promote the first remaining human member — only if the group STILL has no admin (atomic). */
  private Conversation promoteHeirIfNoAdmin(String conversationId, Conversation conversation) {
    boolean noAdmin = conversation.getAdmins() == null || conversation.getAdmins().isEmpty();
    if (!noAdmin || conversation.getParticipants() == null) {
      return conversation;
    }
    String heir =
        conversation.getParticipants().stream()
            .filter(p -> !AiConstants.AI_BOT_USER_ID.equals(p) && !p.startsWith("extbot:"))
            .findFirst()
            .orElse(null);
    if (heir == null) {
      return conversation;
    }
    Conversation promoted =
        support.update(
            conversationId,
            new Criteria()
                .orOperator(
                    Criteria.where("admins").size(0), Criteria.where("admins").exists(false)),
            new Update().push("admins", heir));
    return promoted != null ? promoted : conversation;
  }

  /**
   * Disappearing messages. In a group only admins may change it (any participant of a direct chat).
   * Enabling stamps {@code autoDeleteEnabledAt}; the sweep only ever deletes messages created
   * at/after that instant, so switching it on can no longer wipe the existing history. Changing the
   * window while enabled keeps the original instant; disabling clears both fields.
   */
  public AutoDeleteChange setAutoDelete(String userId, String conversationId, Integer seconds) {
    Conversation conversation = support.requireParticipant(userId, conversationId);
    if (conversation.isGroup() && !ConversationWriteSupport.isAdmin(conversation, userId)) {
      throw ConversationWriteSupport.adminRequired(
          "Only admins can change disappearing messages in a group");
    }
    Integer target = seconds != null && seconds > 0 ? seconds : null;
    boolean enabled = conversation.getAutoDeleteSeconds() != null;
    if (Objects.equals(target, conversation.getAutoDeleteSeconds())
        && (target == null || conversation.getAutoDeleteEnabledAt() != null)) {
      return new AutoDeleteChange(
          support.view(conversation, userId), false, target == null ? 0 : target);
    }
    Update update;
    if (target == null) {
      update = new Update().unset("autoDeleteSeconds").unset("autoDeleteEnabledAt");
    } else {
      update = new Update().set("autoDeleteSeconds", target);
      if (!enabled || conversation.getAutoDeleteEnabledAt() == null) {
        update.set("autoDeleteEnabledAt", Instant.now());
      }
    }
    Conversation updated = support.updateAsParticipant(userId, conversationId, update);
    return new AutoDeleteChange(support.view(updated, userId), true, target == null ? 0 : target);
  }

  public ConversationResponse getConversation(String userId, String conversationId) {
    return support.view(support.requireParticipant(userId, conversationId), userId);
  }

  /**
   * Accept a pending stranger request. Only a participant who did NOT initiate the conversation may
   * accept it. For a group, accepting an invite removes the caller from {@code pendingMembers}.
   */
  public ConversationResponse acceptConversation(String userId, String conversationId) {
    Conversation conversation = support.requireParticipant(userId, conversationId);
    Update update;
    if (Conversation.TYPE_DIRECT.equals(conversation.resolvedType())) {
      if (userId.equals(conversation.getCreatedBy())) {
        throw new ForbiddenException("The initiator cannot accept their own request");
      }
      update = new Update().set("status", Conversation.STATUS_ACCEPTED);
    } else {
      update = new Update().pull("pendingMembers", userId);
    }
    return support.view(support.updateAsParticipant(userId, conversationId, update), userId);
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
    Conversation updated =
        support.update(
            conversationId,
            Criteria.where("publicChannel").is(true).and("type").is(Conversation.TYPE_GROUP),
            new Update().addToSet("participants", userId));
    if (updated == null) {
      throw new ForbiddenException("This channel is not publicly joinable");
    }
    membershipCache.invalidate(conversationId);
    return support.view(updated, userId);
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
}
