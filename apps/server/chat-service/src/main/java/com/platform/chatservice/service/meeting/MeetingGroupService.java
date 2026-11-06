package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.ConversationCacheService;
import com.platform.chatservice.service.ConversationService;
import com.platform.chatservice.service.MessageNotificationService;
import com.platform.chatservice.service.MessageService;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/** Finds or creates the group chat that holds a meeting's AI summary. */
@Slf4j
@Component
@RequiredArgsConstructor
public class MeetingGroupService {

  static final int MAX_NAME = 100;

  private final MeetingStore store;
  private final ConversationService conversationService;
  private final ConversationRepository conversationRepository;
  private final MessageService messageService;
  private final ClusterMessageBroker clusterBroker;
  private final MessageNotificationService notificationService;
  private final ConversationCacheService conversationCache;

  /**
   * The meeting's group: the linked one while it still exists, otherwise a new one (needs at least
   * 2 members) that is linked to the meeting. Empty when there is no group and none can be made. A
   * newly created group opens with the {@code system.group.created} notice.
   */
  public Optional<String> ensureGroup(Meeting m) {
    String linked = m.getGroupConversationId();
    if (linked != null && conversationRepository.existsById(linked)) {
      return Optional.of(linked);
    }
    List<String> members = MeetingGroupMembers.of(m);
    if (members.size() < 2) {
      return Optional.empty();
    }
    String hostId = m.getHostId() != null ? m.getHostId() : members.get(0);
    String created =
        conversationService.createMeetingGroup(hostId, groupName(m), members, m.getId()).id();
    boolean linkedNow =
        linked == null
            ? store.setGroupConversation(m.getId(), created)
            : store.replaceGroupConversation(m.getId(), linked, created);
    if (!linkedNow) {
      // Another writer linked a group first: drop ours, use theirs.
      conversationRepository.deleteById(created);
      conversationCache.evict(created);
      return store.findById(m.getId()).map(Meeting::getGroupConversationId);
    }
    announceCreated(created, hostId);
    return Optional.of(created);
  }

  private void announceCreated(String conversationId, String hostId) {
    try {
      MessageResponse system =
          messageService.createSystemMessage(conversationId, "system.group.created");
      clusterBroker.convertAndSend("/topic/conversation/" + conversationId, system);
      notificationService.notifySystemNotice(hostId, system);
    } catch (Exception e) {
      log.warn(
          "Meeting group {} created but its notice failed: {}", conversationId, e.getMessage());
    }
  }

  static String groupName(Meeting m) {
    String label =
        m.getTitle() != null && !m.getTitle().isBlank() ? m.getTitle().trim() : m.getCode();
    String name = "Họp: " + label;
    if (name.codePointCount(0, name.length()) <= MAX_NAME) {
      return name;
    }
    return name.substring(0, name.offsetByCodePoints(0, MAX_NAME));
  }
}
