package com.platform.chatservice.controller;

import com.platform.chatservice.dto.AutoDeleteRequest;
import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.dto.CreateConversationRequest;
import com.platform.chatservice.dto.CreateGroupRequest;
import com.platform.chatservice.dto.MembersRequest;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.UpdateConversationRequest;
import com.platform.chatservice.dto.WallpaperRequest;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.AttachmentService;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.ConversationEventPublisher;
import com.platform.chatservice.service.ConversationQueryService;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.ConversationUserStateService;
import com.platform.chatservice.service.GroupAdminService;
import com.platform.chatservice.service.MessageQueryService;
import com.platform.chatservice.service.MessageService;
import com.platform.chatservice.service.PageLimits;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

/**
 * Conversation REST API. Realtime side effects follow the {@code CONVERSATION_UPDATED} split (see
 * {@link ConversationEventPublisher}): shared changes go to the conversation topic without any
 * viewer state; per-user changes go to the actor's own user queue only.
 */
@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {

  /** System-message code posted when disappearing messages change ({@code :0} = turned off). */
  static final String SYS_AUTODELETE_CHANGED = "system.autodelete.changed:";

  /** {@code system.admin.promoted:<targetUserId>} — sender = the admin who promoted. */
  static final String SYS_ADMIN_PROMOTED = "system.admin.promoted:";

  /** {@code system.admin.demoted:<targetUserId>} — sender = the admin who demoted. */
  static final String SYS_ADMIN_DEMOTED = "system.admin.demoted:";

  private final ConversationService conversationService;
  private final GroupAdminService groupAdminService;
  private final ConversationUserStateService userStateService;
  private final ConversationQueryService conversationQueryService;
  private final MessageService messageService;
  private final MessageQueryService messageQueryService;
  private final AttachmentService attachmentService;
  private final ClusterMessageBroker clusterBroker;
  private final ConversationEventPublisher events;

  /**
   * The caller's conversations. {@code archived=true} → only archived ones (default: archived ones
   * excluded); {@code blocked=true} → the Blocked section. {@code size} is capped at 100.
   */
  @GetMapping
  public PageResponse<ConversationResponse> listConversations(
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(defaultValue = "false") boolean archived,
      @RequestParam(defaultValue = "false") boolean blocked) {
    if (blocked) {
      return conversationQueryService.listBlockedConversations(
          currentUserId(), PageLimits.of(page, size, 20));
    }
    return conversationQueryService.listConversations(
        currentUserId(), PageLimits.of(page, size, 20), archived);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ConversationResponse createConversation(@RequestBody CreateConversationRequest request) {
    return conversationService.createConversation(currentUserId(), request.participantId());
  }

  @PostMapping("/group")
  @ResponseStatus(HttpStatus.CREATED)
  public ConversationResponse createGroup(@RequestBody CreateGroupRequest request) {
    ConversationResponse group = conversationService.createGroup(currentPrincipal(), request);
    broadcastSystem(group.id(), "system.group.created", currentUserId());
    return group;
  }

  @GetMapping("/{id}")
  public ConversationResponse getConversation(@PathVariable String id) {
    return conversationService.getConversation(currentUserId(), id);
  }

  /**
   * Rename / change avatar / make public or private (admins only, 403 {@code
   * GROUP_ADMIN_REQUIRED}). {@code publicChannel} is optional; {@code true} on a department group
   * is 400 {@code PUBLIC_DEPARTMENT_CHANNEL_NOT_ALLOWED}.
   */
  @PutMapping("/{id}")
  public ConversationResponse updateGroup(
      @PathVariable String id, @RequestBody UpdateConversationRequest request) {
    ConversationResponse updated =
        conversationService.updateGroup(
            currentUserId(), id, request.name(), request.avatarUrl(), request.publicChannel());
    events.publishShared(updated);
    return updated;
  }

  /**
   * Make a member a group admin (F4). Idempotent for an existing admin. A real change broadcasts
   * the shared CONVERSATION_UPDATED and a {@code system.admin.promoted:<userId>} notice sent by the
   * caller. Errors: 400 {@code NOT_A_GROUP}, 403 {@code GROUP_ADMIN_REQUIRED}, 404 {@code
   * NOT_A_MEMBER}.
   */
  @PostMapping("/{id}/admins/{userId}")
  public ConversationResponse promoteAdmin(@PathVariable String id, @PathVariable String userId) {
    String actorId = currentUserId();
    return applyAdminChange(
        id, actorId, groupAdminService.promote(actorId, id, userId), SYS_ADMIN_PROMOTED + userId);
  }

  /**
   * Remove a member's admin rights (F4; self-demotion allowed). Idempotent for a non-admin. 409
   * {@code LAST_ADMIN_CANNOT_BE_REMOVED} for the only admin; otherwise same errors and side effects
   * as {@link #promoteAdmin} with {@code system.admin.demoted:<userId>}.
   */
  @DeleteMapping("/{id}/admins/{userId}")
  public ConversationResponse demoteAdmin(@PathVariable String id, @PathVariable String userId) {
    String actorId = currentUserId();
    return applyAdminChange(
        id, actorId, groupAdminService.demote(actorId, id, userId), SYS_ADMIN_DEMOTED + userId);
  }

  private ConversationResponse applyAdminChange(
      String conversationId,
      String actorId,
      GroupAdminService.AdminChange change,
      String systemCode) {
    if (change.changed()) {
      events.publishShared(change.conversation());
      broadcastSystem(conversationId, systemCode, actorId, true);
    }
    return change.conversation();
  }

  /**
   * Set the shared conversation wallpaper (direct + group). Any participant may set it — NOT
   * admin-gated. Broadcasts CONVERSATION_UPDATED so every member re-resolves the wallpaper.
   */
  @PutMapping("/{id}/wallpaper")
  public ConversationResponse setWallpaper(
      @PathVariable String id, @RequestBody WallpaperRequest request) {
    ConversationResponse updated =
        conversationService.setWallpaper(currentUserId(), id, request.wallpaper());
    events.publishShared(updated);
    return updated;
  }

  @PostMapping("/{id}/members")
  public ConversationResponse addMembers(
      @PathVariable String id, @RequestBody MembersRequest request) {
    ConversationResponse updated =
        conversationService.addMembers(currentUserId(), id, request.userIds());
    events.publishShared(updated);
    broadcastSystem(id, "system.members.added", currentUserId());
    return updated;
  }

  /**
   * Remove a member (or leave). The removed user no longer receives topic frames (outbound
   * membership filter), so they get the shared view on their own queue — its {@code participants}
   * no longer contains them.
   */
  @DeleteMapping("/{id}/members/{userId}")
  public ConversationResponse removeMember(@PathVariable String id, @PathVariable String userId) {
    String actorId = currentUserId();
    ConversationResponse updated = conversationService.removeMember(actorId, id, userId);
    events.publishShared(updated);
    events.publishToUser(userId, updated.withoutViewerState());
    broadcastSystem(
        id, actorId.equals(userId) ? "system.member.left" : "system.member.removed", actorId);
    return updated;
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteConversation(@PathVariable String id) {
    userStateService.deleteConversation(currentUserId(), id);
  }

  @PostMapping("/{id}/clear")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void clearHistory(@PathVariable String id) {
    String userId = currentUserId();
    events.publishToUser(userId, userStateService.clearHistory(userId, id));
  }

  /** Accept a pending stranger message request (shared: the status changes for both sides). */
  @PostMapping("/{id}/accept")
  public ConversationResponse acceptConversation(@PathVariable String id) {
    ConversationResponse updated = conversationService.acceptConversation(currentUserId(), id);
    events.publishShared(updated);
    return updated;
  }

  record MuteDurationRequest(Long durationSeconds) {}

  @PostMapping("/{id}/mute")
  public ConversationResponse muteConversation(
      @PathVariable String id, @RequestBody(required = false) MuteDurationRequest body) {
    long seconds = (body == null || body.durationSeconds() == null) ? -1L : body.durationSeconds();
    return toActor(userStateService.mute(currentUserId(), id, seconds));
  }

  @PostMapping("/{id}/unmute")
  public ConversationResponse unmuteConversation(@PathVariable String id) {
    return toActor(userStateService.unmute(currentUserId(), id));
  }

  @PostMapping("/{id}/archive")
  public ConversationResponse archiveConversation(@PathVariable String id) {
    return toActor(userStateService.archive(currentUserId(), id));
  }

  @PostMapping("/{id}/unarchive")
  public ConversationResponse unarchiveConversation(@PathVariable String id) {
    return toActor(userStateService.unarchive(currentUserId(), id));
  }

  @PostMapping("/{id}/block-archive")
  public ConversationResponse blockArchive(@PathVariable String id) {
    return toActor(userStateService.blockArchive(currentUserId(), id));
  }

  @PostMapping("/{id}/block-restore")
  public ConversationResponse blockRestore(@PathVariable String id) {
    return toActor(userStateService.blockRestore(currentUserId(), id));
  }

  @PostMapping("/{id}/unread")
  public ConversationResponse markConversationUnread(@PathVariable String id) {
    return toActor(userStateService.markUnread(currentUserId(), id));
  }

  @PostMapping("/{id}/read")
  public ConversationResponse markConversationRead(@PathVariable String id) {
    return toActor(userStateService.markRead(currentUserId(), id));
  }

  /**
   * Disappearing messages (group: admins only, 403 {@code GROUP_ADMIN_REQUIRED}). A real change is
   * broadcast as a shared CONVERSATION_UPDATED and announced with a {@code
   * system.autodelete.changed:<seconds>} notice ({@code 0} = turned off).
   */
  @PutMapping("/{id}/settings")
  public ConversationResponse updateSettings(
      @PathVariable String id, @RequestBody AutoDeleteRequest request) {
    String userId = currentUserId();
    ConversationService.AutoDeleteChange change =
        conversationService.setAutoDelete(userId, id, request.autoDeleteSeconds());
    if (change.changed()) {
      events.publishShared(change.conversation());
      broadcastSystem(id, SYS_AUTODELETE_CHANGED + change.seconds(), userId);
    }
    return change.conversation();
  }

  /** List all public group channels, optionally filtered by name (Task 52). */
  @GetMapping("/public")
  public PageResponse<ConversationResponse> listPublicChannels(
      @RequestParam(required = false) String q,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return conversationQueryService.listPublicChannels(q, PageLimits.of(page, size, 20));
  }

  /** Join a public channel (Task 52). */
  @PostMapping("/{id}/join")
  public ConversationResponse joinChannel(@PathVariable String id) {
    ConversationResponse updated = conversationService.joinChannel(currentUserId(), id);
    events.publishShared(updated);
    broadcastSystem(id, "system.member.joined", currentUserId());
    return updated;
  }

  /**
   * Cursor-based fetch ({@code before} = oldest message id known) for normal pagination, or
   * catch-up fetch ({@code after} = ISO timestamp of the newest known message, plus optional {@code
   * afterId} = its id as a same-millisecond tiebreaker) for the reconnect flow (Task 55). Catch-up
   * pages are oldest-first, at most 50 rows, with {@code hasNext} set when more remain — clients
   * loop with the last row's {@code createdAt}/{@code id}.
   */
  @GetMapping("/{conversationId}/messages")
  public PageResponse<MessageResponse> getMessages(
      @PathVariable String conversationId,
      @RequestParam(required = false) String before,
      @RequestParam(required = false) String after,
      @RequestParam(required = false) String afterId,
      @RequestParam(defaultValue = "20") int size) {
    if (after != null && !after.isBlank()) {
      return messageQueryService.getMessagesSince(
          currentUserId(), conversationId, parseInstant(after), afterId);
    }
    return messageQueryService.getMessages(
        currentUserId(), conversationId, before, PageLimits.size(size, 20));
  }

  /** Shared media/files/links gallery (Task 57). */
  @GetMapping("/{conversationId}/attachments")
  public PageResponse<MessageResponse> getSharedAttachments(
      @PathVariable String conversationId,
      @RequestParam(defaultValue = "media") String type,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "30") int size) {
    return attachmentService.getSharedAttachments(
        currentUserId(),
        conversationId,
        type,
        PageLimits.of(page, size, 30, Sort.by(Sort.Direction.DESC, "createdAt")));
  }

  /** Per-user change: only the actor's own devices hear about it. */
  private ConversationResponse toActor(ConversationResponse updated) {
    events.publishToUser(currentUserId(), updated);
    return updated;
  }

  /**
   * Persist + broadcast a system message. Content is an i18n key the client maps. Every participant
   * except the actor gets a NEW_MESSAGE notification (the actor already knows what they did).
   */
  private void broadcastSystem(String conversationId, String contentKey, String actorId) {
    broadcastSystem(conversationId, contentKey, actorId, false);
  }

  /** {@code fromActor}: the notice's sender is the actor (its humanizer names them). */
  private void broadcastSystem(
      String conversationId, String contentKey, String actorId, boolean fromActor) {
    MessageResponse system =
        fromActor
            ? messageService.createSystemMessage(conversationId, contentKey, actorId)
            : messageService.createSystemMessage(conversationId, contentKey);
    clusterBroker.convertAndSend("/topic/conversation/" + conversationId, system);
    for (String participantId : conversationQueryService.getParticipants(conversationId)) {
      if (participantId.equals(actorId)) {
        continue;
      }
      clusterBroker.convertAndSendToUser(
          participantId,
          "/queue/notifications",
          Map.of("type", "NEW_MESSAGE", "conversationId", conversationId, "senderName", "system"));
    }
  }

  private static Instant parseInstant(String value) {
    try {
      return Instant.parse(value.trim());
    } catch (DateTimeParseException e) {
      throw new BadRequestException(
          ErrorCodes.INVALID_PARAMETER, "'after' must be an ISO-8601 instant");
    }
  }

  private String currentUserId() {
    return currentPrincipal().getUserId();
  }

  private UserPrincipal currentPrincipal() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication instanceof UserPrincipal principal) {
      return principal;
    }
    throw new UnauthorizedException("User is not authenticated");
  }
}
