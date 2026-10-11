package com.platform.chatservice.service;

import com.platform.chatservice.dto.WebRTCSignalDto;
import com.platform.chatservice.repository.CallSessionRepository;
import com.platform.chatservice.repository.UserBlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Relays peer-to-peer call signaling ({@code offer / answer / ice / end / state}) between two
 * members of a conversation, onto the target's {@code /user/queue/webrtc}.
 *
 * <p>The relay used to forward to ANY {@code targetId}: a stranger — or someone the target had
 * blocked — could make their phone ring with a fake offer or hang up their call. Every signal now
 * names a conversation (1-on-1: {@code conversationId}; group mesh: the {@code callId}'s
 * conversation) that both ends belong to, and a 1-on-1 signal from someone the target blocked is
 * dropped. Signals that do not qualify are dropped silently, as before for malformed ones.
 */
@Service
@RequiredArgsConstructor
public class CallSignalRelay {

  private static final String WEBRTC_QUEUE = "/queue/webrtc";

  private final ClusterMessageBroker broker;
  private final ConversationMembershipCache membership;
  private final UserBlockRepository blocks;
  private final CallSessionRepository sessions;

  /** offer / answer / ice. With a {@code callId}: group mesh; without: the 1-on-1 relay. */
  public void relay(String fromUserId, String type, WebRTCSignalDto dto) {
    if (dto == null || dto.getTargetId() == null) {
      return;
    }
    if (dto.getCallId() != null && !dto.getCallId().isBlank()) {
      relayGroup(fromUserId, type, dto);
      return;
    }
    if (!directPeers(fromUserId, dto)) {
      return;
    }
    dto.setSenderId(fromUserId);
    broker.convertAndSendToUser(dto.getTargetId(), WEBRTC_QUEUE, dto);
    if ("answer".equals(type)) {
      // The callee may be signed in elsewhere (web + phone), all of them ringing: the ones that
      // did not answer stop. The answering session ignores it (it is no longer ringing).
      WebRTCSignalDto answered = new WebRTCSignalDto();
      answered.setType("answered-elsewhere");
      answered.setSenderId(dto.getTargetId());
      answered.setTargetId(fromUserId);
      answered.setConversationId(dto.getConversationId());
      broker.convertAndSendToUser(fromUserId, WEBRTC_QUEUE, answered);
    }
  }

  /**
   * A 1-on-1 hang-up for the other peer. Deliberately writes no call-log message: the initiating
   * client sends a coded {@code system.call.*} message itself.
   */
  public void relayEnd(String fromUserId, WebRTCSignalDto dto) {
    if (dto == null || !directPeers(fromUserId, dto)) {
      return;
    }
    dto.setSenderId(fromUserId);
    broker.convertAndSendToUser(dto.getTargetId(), WEBRTC_QUEUE, dto);
  }

  /** In-call state (camera, receive quality, restart request) for the other person. */
  public void relayState(String fromUserId, WebRTCSignalDto dto) {
    if (dto == null || !bothMembers(fromUserId, dto.getTargetId(), dto.getConversationId())) {
      return;
    }
    dto.setSenderId(fromUserId);
    dto.setType("state");
    broker.convertAndSendToUser(dto.getTargetId(), WEBRTC_QUEUE, dto);
  }

  private void relayGroup(String fromUserId, String type, WebRTCSignalDto dto) {
    String conversationId =
        sessions
            .findByCallId(dto.getCallId())
            .filter(s -> s.getEndedAt() == null)
            .map(s -> s.getConversationId())
            .orElse(null);
    if (!bothMembers(fromUserId, dto.getTargetId(), conversationId)) {
      return;
    }
    dto.setType(type);
    dto.setFromId(fromUserId);
    dto.setSenderId(fromUserId);
    broker.convertAndSendToUser(dto.getTargetId(), WEBRTC_QUEUE, dto);
  }

  /** Both are members of the named conversation, and the target has not blocked the sender. */
  private boolean directPeers(String fromUserId, WebRTCSignalDto dto) {
    return bothMembers(fromUserId, dto.getTargetId(), dto.getConversationId())
        && !blocks.existsByBlockerIdAndBlockedId(dto.getTargetId(), fromUserId);
  }

  private boolean bothMembers(String fromUserId, String targetId, String conversationId) {
    return fromUserId != null
        && targetId != null
        && conversationId != null
        && !fromUserId.equals(targetId)
        && membership.isMember(conversationId, fromUserId)
        && membership.isMember(conversationId, targetId);
  }
}
