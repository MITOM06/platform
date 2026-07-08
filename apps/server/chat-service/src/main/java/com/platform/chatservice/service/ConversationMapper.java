package com.platform.chatservice.service;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.MessageRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Maps a {@link Conversation} document to its {@link ConversationResponse} DTO, including the
 * per-user derived flags (muted/archived/blocked) and resolved pinned-message previews. Extracted
 * from {@code ConversationService} (mirrors {@link MessageMapper}) so the read and write services
 * share one mapping definition and both stay within the clean-code file-length limit.
 */
@Component
@RequiredArgsConstructor
public class ConversationMapper {

  private final MessageRepository messageRepository;

  public ConversationResponse toResponse(Conversation c, String userId, long unreadCount) {
    ConversationResponse.LastMessageDto lastMsg = null;
    if (c.getLastMessage() != null) {
      lastMsg =
          new ConversationResponse.LastMessageDto(
              c.getLastMessage().getContent(),
              c.getLastMessage().getSenderId(),
              c.getLastMessage().getCreatedAt());
    }
    List<ConversationResponse.PinnedMessageDto> pinned = resolvePinnedMessages(c);
    Long muteUntil =
        (userId != null && c.getMutedUntil() != null) ? c.getMutedUntil().get(userId) : null;
    boolean isMuted = muteUntil != null && muteUntil > System.currentTimeMillis();
    Long muteExpiresAt = isMuted ? muteUntil : null;
    boolean isArchived =
        userId != null && c.getArchivedBy() != null && c.getArchivedBy().contains(userId);
    boolean isBlocked =
        userId != null && c.getBlockedBy() != null && c.getBlockedBy().contains(userId);
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
        c.getWallpaper(),
        isBlocked,
        muteExpiresAt,
        c.getPendingMembers() != null ? c.getPendingMembers() : List.of());
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
        .filter(m -> m != null && !m.isRecalled() && !"system".equals(m.getType()))
        .map(
            m ->
                new ConversationResponse.PinnedMessageDto(
                    m.getId(), m.getSenderId(), m.getContent(), m.getCreatedAt(), m.getType()))
        .toList();
  }
}
