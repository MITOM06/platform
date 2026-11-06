package com.platform.chatservice.service.meeting;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingSummaryDoc;
import com.platform.chatservice.model.MeetingSummaryState;
import com.platform.chatservice.service.AiConstants;
import com.platform.chatservice.service.AiMessageService;
import com.platform.chatservice.service.MessageNotificationService;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;

/**
 * Subscribes to {@code meet:summary:result} (produced by ai-service): records the outcome on the
 * meeting, saves the summary, posts it into the meeting's group chat as the AI bot and tells the
 * clients.
 *
 * <p>Pub/sub fans the result out to every instance; {@link MeetingStore#finishSummary} is the
 * cluster-wide dedupe — only the first caller for the current attempt goes on.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MeetingSummaryResultListener implements MessageListener {

  public static final String CHANNEL = "meet:summary:result";

  private final MeetingStore store;
  private final MeetingSummaryStore summaries;
  private final MeetingGroupService groups;
  private final AiMessageService aiMessageService;
  private final MessageNotificationService notificationService;
  private final MeetingEvents events;
  private final ObjectMapper objectMapper;

  @Override
  public void onMessage(org.springframework.data.redis.connection.Message message, byte[] pattern) {
    try {
      handle(objectMapper.readTree(message.getBody()));
    } catch (Exception e) {
      log.error("Failed to process {} message", CHANNEL, e);
    }
  }

  void handle(JsonNode root) {
    String meetingId = text(root, "meetingId");
    String attempt = text(root, "attempt");
    String status = text(root, "status");
    if (meetingId == null || attempt == null) {
      log.warn("{} missing meetingId or attempt", CHANNEL);
      return;
    }
    MeetingSummaryState state = stateOf(status);
    if (state == null) {
      log.warn("{} for meeting {} has unknown status", CHANNEL, meetingId);
      return;
    }
    JsonNode summary = root.get("summary");
    boolean ok = state == MeetingSummaryState.DONE;
    if (ok && (summary == null || !summary.isObject())) {
      log.warn("{} ok without summary for meeting {}", CHANNEL, meetingId);
      return;
    }

    Optional<Meeting> finished = store.finishSummary(meetingId, attempt, state);
    if (finished.isEmpty()) {
      return; // stale attempt, or another instance already took this result
    }
    Meeting m = finished.get();
    if (ok) {
      try {
        summaries.save(
            MeetingSummaryDoc.builder()
                .meetingId(meetingId)
                .attempt(attempt)
                .status(state)
                .summary(
                    objectMapper.convertValue(summary, new TypeReference<Map<String, Object>>() {}))
                .createdAt(Instant.now())
                .build());
      } catch (Exception e) {
        // The state is already DONE; still post and notify so clients refetch (and see the gap).
        log.error("Saving the summary of meeting {} failed", meetingId, e);
      }
      m = postToGroup(m, (ObjectNode) summary);
    }
    try {
      events.summaryReady(m, recipients(m, ok));
    } catch (Exception e) {
      log.error("Sending meet.summary.ready for meeting {} failed", meetingId, e);
    }
  }

  /** Group + post; any failure is logged and leaves the state DONE. Returns the fresh meeting. */
  private Meeting postToGroup(Meeting m, ObjectNode summary) {
    try {
      Optional<String> group = groups.ensureGroup(m);
      if (group.isPresent()) {
        String content = objectMapper.writeValueAsString(card(m, summary));
        MessageResponse posted = aiMessageService.postMeetingSummary(group.get(), content);
        notificationService.notifyNewMessage(AiConstants.AI_BOT_USER_ID, posted);
      }
    } catch (Exception e) {
      log.error("Posting the summary of meeting {} to its group failed", m.getId(), e);
    }
    return store.findById(m.getId()).orElse(m);
  }

  private ObjectNode card(Meeting m, ObjectNode summary) {
    ObjectNode card = summary.deepCopy();
    card.put("meetingId", m.getId());
    if (m.getTitle() == null) {
      card.putNull("title");
    } else {
      card.put("title", m.getTitle());
    }
    ArrayNode attendees = card.putArray("attendees");
    names(m).forEach(attendees::add);
    card.put("durationSec", durationSec(m));
    return card;
  }

  private static Set<String> names(Meeting m) {
    Set<String> out = new LinkedHashSet<>();
    if (m.getAttendance() != null) {
      for (Meeting.Attendance a : m.getAttendance()) {
        if (a != null
            && !AiConstants.AI_BOT_USER_ID.equals(a.getUserId())
            && a.getDisplayName() != null
            && !a.getDisplayName().isBlank()) {
          out.add(a.getDisplayName());
        }
      }
    }
    return out;
  }

  private static long durationSec(Meeting m) {
    if (m.getStartedAt() == null || m.getEndedAt() == null) {
      return 0;
    }
    return Math.max(0, Duration.between(m.getStartedAt(), m.getEndedAt()).getSeconds());
  }

  /** Group members, host and co-hosts when a summary was posted; host and co-hosts otherwise. */
  private static Set<String> recipients(Meeting m, boolean ok) {
    Set<String> out = new LinkedHashSet<>();
    if (m.getHostId() != null) {
      out.add(m.getHostId());
    }
    if (m.getCoHostIds() != null) {
      out.addAll(m.getCoHostIds());
    }
    if (ok && m.getGroupConversationId() != null) {
      out.addAll(MeetingGroupMembers.of(m));
    }
    return out;
  }

  private static MeetingSummaryState stateOf(String status) {
    if (status == null) {
      return null;
    }
    return switch (status) {
      case "ok" -> MeetingSummaryState.DONE;
      case "empty" -> MeetingSummaryState.EMPTY;
      case "failed" -> MeetingSummaryState.FAILED;
      default -> null;
    };
  }

  private static String text(JsonNode root, String field) {
    JsonNode n = root.get(field);
    return n != null && n.isTextual() && !n.asText().isBlank() ? n.asText() : null;
  }
}
