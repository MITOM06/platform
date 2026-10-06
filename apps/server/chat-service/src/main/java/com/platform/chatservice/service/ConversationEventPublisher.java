package com.platform.chatservice.service;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.repository.ConversationRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The two {@code CONVERSATION_UPDATED} channels:
 *
 * <ul>
 *   <li><b>Shared changes</b> (rename, avatar, members, wallpaper, accept, auto-delete, lastMessage
 *       refresh) → {@code /topic/conversation/{id}}, with every viewer-specific field removed
 *       ({@link ConversationResponse#withoutViewerState()}). Every member receives the same frame,
 *       so it must never carry the actor's own mute / archive / block / unread state — mobile
 *       copied those into its list and hid or archived the chat for everyone.
 *   <li><b>Per-user changes</b> (mute, unmute, archive, unarchive, read, unread, block-archive,
 *       block-restore, clear) → only the actor, on {@code /user/queue/notifications}, with the
 *       actor's full view (so their other devices stay in sync).
 * </ul>
 *
 * Both go through {@link ClusterMessageBroker}, so they reach sockets on every instance.
 */
@Component
@RequiredArgsConstructor
public class ConversationEventPublisher {

  static final String EVENT_TYPE = "CONVERSATION_UPDATED";
  private static final String USER_QUEUE = "/queue/notifications";

  private final ClusterMessageBroker clusterBroker;
  private final ConversationRepository conversationRepository;
  private final ConversationMapper conversationMapper;

  /** Broadcast a shared change to all members (viewer state stripped). */
  public void publishShared(ConversationResponse view) {
    if (view == null) return;
    clusterBroker.convertAndSend(
        "/topic/conversation/" + view.id(),
        Map.of("type", EVENT_TYPE, "conversation", view.withoutViewerState()));
  }

  /** Reload {@code conversationId} and broadcast its shared view (e.g. after a preview refresh). */
  public void publishShared(String conversationId) {
    conversationRepository
        .findById(conversationId)
        .ifPresent(c -> publishShared(conversationMapper.toResponse(c, null, 0L)));
  }

  /** Send {@code userId}'s own view of the conversation to that user only. */
  public void publishToUser(String userId, ConversationResponse view) {
    if (userId == null || view == null) return;
    clusterBroker.convertAndSendToUser(
        userId, USER_QUEUE, Map.of("type", EVENT_TYPE, "conversation", view));
  }
}
