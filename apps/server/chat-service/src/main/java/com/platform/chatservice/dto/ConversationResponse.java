package com.platform.chatservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

/**
 * A conversation as seen by ONE viewer (REST responses, and the per-user {@code
 * CONVERSATION_UPDATED} event on {@code /user/queue/notifications}).
 *
 * <p>The viewer-specific fields — {@code unreadCount}, {@code isMuted}, {@code muteExpiresAt},
 * {@code isArchived}, {@code isBlocked} — are nullable and omitted from the JSON when null. {@link
 * #withoutViewerState()} produces the shared form broadcast on {@code /topic/conversation/{id}}:
 * every member receives the same payload, so it must never carry the actor's own mute / archive /
 * block / unread state (clients merge it into their per-user copy).
 */
public record ConversationResponse(
    String id,
    String type,
    String name,
    String avatarUrl,
    List<String> participants,
    List<String> admins,
    String createdBy,
    Integer autoDeleteSeconds,
    LastMessageDto lastMessage,
    Instant lastMessageAt,
    @JsonInclude(JsonInclude.Include.NON_NULL) Long unreadCount,
    Instant createdAt,
    String status,
    boolean isPublic,
    List<PinnedMessageDto> pinnedMessages,
    @JsonInclude(JsonInclude.Include.NON_NULL) Boolean isMuted,
    @JsonInclude(JsonInclude.Include.NON_NULL) Boolean isArchived,
    String wallpaper,
    @JsonInclude(JsonInclude.Include.NON_NULL) Boolean isBlocked,
    @JsonInclude(JsonInclude.Include.NON_NULL) Long muteExpiresAt,
    List<String> pendingMembers,
    @JsonInclude(JsonInclude.Include.NON_NULL) Instant autoDeleteEnabledAt,
    // Department of a department group (shared field). Lets clients disable the
    // public-channel switch up front: a department group can never be public.
    @JsonInclude(JsonInclude.Include.NON_NULL) String departmentId) {

  /**
   * Preview of the newest message. {@code messageId}, {@code type} and {@code recalled} are
   * additive: {@code recalled == true} means the message was unsent ({@code content} is blank) and
   * clients render their localized "message recalled" label; {@code messageId}/{@code type} are
   * null on previews written before they existed.
   */
  public record LastMessageDto(
      String content,
      String senderId,
      Instant createdAt,
      @JsonInclude(JsonInclude.Include.NON_NULL) String messageId,
      @JsonInclude(JsonInclude.Include.NON_NULL) String type,
      boolean recalled) {}

  public record PinnedMessageDto(
      String id, String senderId, String content, Instant createdAt, String type) {}

  /** The same conversation with every viewer-specific field removed (shared topic payload). */
  public ConversationResponse withoutViewerState() {
    return new ConversationResponse(
        id,
        type,
        name,
        avatarUrl,
        participants,
        admins,
        createdBy,
        autoDeleteSeconds,
        lastMessage,
        lastMessageAt,
        null,
        createdAt,
        status,
        isPublic,
        pinnedMessages,
        null,
        null,
        wallpaper,
        null,
        null,
        pendingMembers,
        autoDeleteEnabledAt,
        departmentId);
  }
}
