package com.platform.chatservice.service;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.model.PendingAction;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * chat-service side of in-chat confirmation for sensitive AI actions (F2).
 *
 * <ul>
 *   <li><b>Inbound sanitizing</b> — {@link #parseActions} / {@link #parseAction} turn ai-service's
 *       action objects ({@code AI_STREAM_DONE.pendingActions[]}, {@code AI_ACTION_PENDING.action})
 *       into {@link PendingAction}s holding display fields only (never the tool input), with
 *       bounded sizes; {@link #toWire} is the client-facing shape.
 *   <li><b>Resolution</b> — {@link #resolve} handles {@code ai:action:resolved}: one atomic
 *       positional {@code $set} flips the matching element from {@code pending} to the final status
 *       and the instance whose update matched broadcasts {@code MESSAGE_UPDATED}. Every instance
 *       receives the event; the {@code status: pending} guard makes exactly one update (and one
 *       broadcast) win.
 *   <li><b>Early resolution</b> — the requester can confirm from the {@code AI_ACTION_PENDING} card
 *       while the reply is still streaming, i.e. before the AI message exists. {@link #resolve}
 *       therefore first remembers the outcome in Redis ({@value #RESOLVED_KEY_PREFIX} {id}) and
 *       {@link #reconcile} — run right after the AI message is persisted — applies any remembered
 *       outcome. Write-then-update on one side and insert-then-read on the other means at least one
 *       of them sees the other, so the outcome is never lost.
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiPendingActionService {

  static final String RESOLVED_KEY_PREFIX = "chat:ai-action-resolved:";

  /** Outlives ai-service's 10-minute pending-action TTL with margin. */
  static final Duration RESOLVED_KEY_TTL = Duration.ofMinutes(30);

  static final int MAX_ACTIONS_PER_MESSAGE = 10;
  private static final int MAX_ID_LENGTH = 64;
  private static final int MAX_NAME_LENGTH = 128;
  private static final int MAX_SUMMARY_ENTRIES = 20;
  private static final int MAX_SUMMARY_STRING = 500;

  private static final FindAndModifyOptions RETURN_NEW =
      FindAndModifyOptions.options().returnNew(true);

  private final MongoTemplate mongoTemplate;
  private final StringRedisTemplate redisTemplate;
  private final ClusterMessageBroker clusterBroker;
  private final MessageMapper messageMapper;

  // ------------------------------------------------------------------ parsing

  /** Sanitized actions of an {@code AI_STREAM_DONE.pendingActions} value (empty when absent). */
  public static List<PendingAction> parseActions(Object raw, String requesterId) {
    if (!(raw instanceof List<?> list) || list.isEmpty()) {
      return List.of();
    }
    List<PendingAction> actions = new ArrayList<>();
    for (Object item : list) {
      if (actions.size() >= MAX_ACTIONS_PER_MESSAGE) break;
      PendingAction action = parseAction(item, requesterId);
      if (action != null && actions.stream().noneMatch(a -> a.getId().equals(action.getId()))) {
        actions.add(action);
      }
    }
    return actions;
  }

  /**
   * One sanitized action, or null when {@code raw} is not an object with an id. {@code requesterId}
   * is the reply's requester, used unless the action names its own.
   */
  public static PendingAction parseAction(Object raw, String requesterId) {
    if (!(raw instanceof Map<?, ?> map)) {
      return null;
    }
    String id = text(map.get("id"), MAX_ID_LENGTH);
    if (id == null) {
      return null;
    }
    String ownRequester = text(map.get("requesterId"), MAX_ID_LENGTH);
    return PendingAction.builder()
        .id(id)
        .toolName(text(map.get("toolName"), MAX_NAME_LENGTH))
        .provider(text(map.get("provider"), MAX_NAME_LENGTH))
        .summary(summary(map.get("summary")))
        .status(status(map.get("status")))
        .expiresAt(instant(map.get("expiresAt")))
        .requesterId(ownRequester != null ? ownRequester : blankToNull(requesterId))
        .build();
  }

  /** Client-facing shape of an action (null fields omitted). */
  public static Map<String, Object> toWire(PendingAction action) {
    Map<String, Object> wire = new LinkedHashMap<>();
    wire.put("id", action.getId());
    putIfPresent(wire, "toolName", action.getToolName());
    putIfPresent(wire, "provider", action.getProvider());
    putIfPresent(wire, "summary", action.getSummary());
    wire.put("status", action.getStatus());
    putIfPresent(
        wire, "expiresAt", action.getExpiresAt() == null ? null : action.getExpiresAt().toString());
    putIfPresent(wire, "requesterId", action.getRequesterId());
    return wire;
  }

  // ------------------------------------------------------------------ resolution

  /**
   * Apply an {@code ai:action:resolved} outcome. Unknown statuses and blank ids are ignored. Safe
   * to run on every instance: only the update that still finds the element {@code pending} matches.
   */
  public void resolve(String actionId, String conversationId, String status) {
    String id = text(actionId, MAX_ID_LENGTH);
    String outcome = status == null ? null : status.trim().toLowerCase(Locale.ROOT);
    if (id == null || !PendingAction.RESOLVED_STATUSES.contains(outcome)) {
      log.warn("Ignoring ai:action:resolved with action '{}' / status '{}'", actionId, status);
      return;
    }
    rememberOutcome(id, outcome);
    Message updated = applyStatus(id, blankToNull(conversationId), outcome);
    if (updated != null) {
      broadcastUpdated(updated);
    }
  }

  /**
   * Run right after an AI message with pending actions was persisted: applies outcomes that arrived
   * before the message existed and returns the message as it now is (unchanged when none did).
   */
  public MessageResponse reconcile(MessageResponse saved) {
    if (saved == null || saved.pendingActions() == null || saved.pendingActions().isEmpty()) {
      return saved;
    }
    List<String> ids =
        saved.pendingActions().stream().map(MessageResponse.PendingActionDto::id).toList();
    List<String> outcomes;
    try {
      outcomes = redisTemplate.opsForValue().multiGet(ids.stream().map(this::key).toList());
    } catch (RuntimeException e) {
      log.warn(
          "Could not read early AI action outcomes for message {}: {}", saved.id(), e.toString());
      return saved;
    }
    if (outcomes == null) {
      return saved;
    }
    boolean applied = false;
    for (int i = 0; i < ids.size() && i < outcomes.size(); i++) {
      String outcome = outcomes.get(i);
      if (outcome != null && PendingAction.RESOLVED_STATUSES.contains(outcome)) {
        applyStatus(ids.get(i), saved.conversationId(), outcome);
        applied = true;
      }
    }
    if (!applied) {
      return saved;
    }
    Message current = mongoTemplate.findById(saved.id(), Message.class);
    return current == null ? saved : messageMapper.toResponse(current);
  }

  private Message applyStatus(String actionId, String conversationId, String status) {
    Criteria element =
        Criteria.where("id").is(actionId).and("status").is(PendingAction.STATUS_PENDING);
    Criteria criteria =
        conversationId == null
            ? Criteria.where("pendingActions").elemMatch(element)
            : Criteria.where("conversationId")
                .is(conversationId)
                .and("pendingActions")
                .elemMatch(element);
    return mongoTemplate.findAndModify(
        new Query(criteria),
        new Update().set("pendingActions.$.status", status),
        RETURN_NEW,
        Message.class);
  }

  private void rememberOutcome(String actionId, String status) {
    try {
      redisTemplate.opsForValue().set(key(actionId), status, RESOLVED_KEY_TTL);
    } catch (RuntimeException e) {
      log.warn("Could not remember AI action outcome {}: {}", actionId, e.toString());
    }
  }

  /**
   * {@code MESSAGE_UPDATED} in the edit event's shape ({@code type, messageId, conversationId,
   * content}) plus {@code pendingActions}; {@code editedAt} only when the message was edited.
   */
  private void broadcastUpdated(Message message) {
    MessageResponse response = messageMapper.toResponse(message);
    Map<String, Object> event = new LinkedHashMap<>();
    event.put("type", "MESSAGE_UPDATED");
    event.put("messageId", response.id());
    event.put("conversationId", response.conversationId());
    event.put("content", response.content() == null ? "" : response.content());
    event.put(
        "pendingActions",
        response.pendingActions() == null ? List.of() : response.pendingActions());
    if (response.editedAt() != null) {
      event.put("editedAt", response.editedAt().toString());
    }
    clusterBroker.convertAndSend("/topic/conversation/" + response.conversationId(), event);
  }

  private String key(String actionId) {
    return RESOLVED_KEY_PREFIX + actionId;
  }

  // ------------------------------------------------------------------ value helpers

  private static String status(Object raw) {
    String value = raw instanceof String s ? s.trim().toLowerCase(Locale.ROOT) : null;
    if (value != null
        && (PendingAction.STATUS_PENDING.equals(value)
            || PendingAction.RESOLVED_STATUSES.contains(value))) {
      return value;
    }
    return PendingAction.STATUS_PENDING;
  }

  /** Only scalars and lists of scalars survive, strings capped — never nested payloads. */
  private static Map<String, Object> summary(Object raw) {
    if (!(raw instanceof Map<?, ?> map)) {
      return null;
    }
    Map<String, Object> out = new LinkedHashMap<>();
    for (Map.Entry<?, ?> e : map.entrySet()) {
      if (out.size() >= MAX_SUMMARY_ENTRIES) break;
      if (!(e.getKey() instanceof String key) || key.isBlank() || key.startsWith("$")) continue;
      Object value = scalar(e.getValue());
      if (value == null && e.getValue() instanceof List<?> list) {
        List<Object> items = new ArrayList<>();
        for (Object item : list) {
          if (items.size() >= MAX_SUMMARY_ENTRIES) break;
          Object scalar = scalar(item);
          if (scalar != null) items.add(scalar);
        }
        value = items;
      }
      if (value != null) out.put(key.replace('.', '_'), value);
    }
    return out;
  }

  private static Object scalar(Object value) {
    if (value instanceof String s) {
      return s.length() > MAX_SUMMARY_STRING ? s.substring(0, MAX_SUMMARY_STRING) : s;
    }
    if (value instanceof Number || value instanceof Boolean) {
      return value;
    }
    return null;
  }

  /** ISO-8601 string, or epoch millis / seconds (number or numeric string); null otherwise. */
  static Instant instant(Object raw) {
    if (raw instanceof Number n) {
      return epoch(n.doubleValue());
    }
    if (raw instanceof String s && !s.isBlank()) {
      String v = s.trim();
      try {
        return Instant.parse(v);
      } catch (DateTimeParseException notIso) {
        try {
          return epoch(Double.parseDouble(v));
        } catch (NumberFormatException e) {
          return null;
        }
      }
    }
    return null;
  }

  private static Instant epoch(double value) {
    if (!Double.isFinite(value) || value <= 0) return null;
    // Anything past ~1973 in milliseconds is > 1e11; seconds stay below that until year 5138.
    return value > 1e11
        ? Instant.ofEpochMilli((long) value)
        : Instant.ofEpochMilli((long) (value * 1000));
  }

  private static String text(Object raw, int max) {
    if (!(raw instanceof String s)) return null;
    String v = s.trim();
    if (v.isEmpty()) return null;
    return v.length() > max ? v.substring(0, max) : v;
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  private static void putIfPresent(Map<String, Object> map, String key, Object value) {
    if (value != null) map.put(key, value);
  }
}
