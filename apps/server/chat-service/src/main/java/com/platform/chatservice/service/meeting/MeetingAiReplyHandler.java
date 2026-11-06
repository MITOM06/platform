package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.MeetingMessageDto;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingMessage;
import com.platform.chatservice.service.AiConstants;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Turns ai-service's reply events for conversation {@code meeting:{id}} into the room's view: the
 * answer is a normal {@code meet.chat} line from the AI bot, a failure is {@code meet.ai error}.
 * Nothing is pushed and nothing goes to the {@code messages} collection. Every instance receives
 * each Redis event, so the outcome is claimed once with SET NX (same scheme as conversations).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MeetingAiReplyHandler {

  static final int CONTENT_MAX = 8000;
  static final String BOT_NAME = "PON AI";
  private static final Duration CLAIM_TTL = Duration.ofMinutes(5);

  private final MongoTemplate mongo;
  private final MeetingEvents events;
  private final StringRedisTemplate redis;

  public void handle(Map<String, Object> event) {
    String convId = text(event, "conversationId");
    String type = text(event, "type");
    if (convId == null || type == null) {
      return;
    }
    String meetingId = convId.substring(AiConstants.MEETING_CONVERSATION_PREFIX.length());
    if (!"AI_STREAM_DONE".equals(type) && !"AI_STREAM_ERROR".equals(type)) {
      return; // CHUNK / TOOL_CALL / ACTION_PENDING: the meeting chat does not stream
    }
    if (!mongo.exists(Query.query(Criteria.where("_id").is(meetingId)), Meeting.class)) {
      log.info("Dropping AI reply for meeting {} that no longer exists", meetingId);
      return;
    }
    String requesterId = text(event, "requesterId");
    String replyId = text(event, "replyId");
    if ("AI_STREAM_ERROR".equals(type)) {
      String code = text(event, "code");
      if (claim(convId, "err:", replyId, code)) {
        events.ai(meetingId, "error", requesterId, code == null ? "AI_ERROR" : code);
      }
      return;
    }
    String full = event.get("fullContent") instanceof String s ? s : null;
    if (!claim(convId, "", replyId, full)) {
      return;
    }
    if (full == null || full.isBlank()) {
      events.ai(meetingId, "error", requesterId, "AI_EMPTY");
      return;
    }
    String content = full.length() > CONTENT_MAX ? full.substring(0, CONTENT_MAX) : full;
    MeetingMessage saved =
        mongo.insert(
            MeetingMessage.builder()
                .meetingId(meetingId)
                .senderId(AiConstants.AI_BOT_USER_ID)
                .content(content)
                .createdAt(Instant.now().truncatedTo(ChronoUnit.MILLIS))
                .build());
    events.chat(
        meetingId,
        new MeetingMessageDto(
            saved.getId(),
            new PersonDto(AiConstants.AI_BOT_USER_ID, BOT_NAME, null),
            saved.getContent(),
            saved.getCreatedAt()),
        null);
  }

  /** True for the one instance that wins the claim of this reply's outcome. */
  private boolean claim(String convId, String kind, String replyId, String fallback) {
    String key =
        "ai:done:"
            + convId
            + ":"
            + kind
            + (replyId != null
                ? replyId
                : Integer.toHexString(fallback == null ? 0 : fallback.hashCode()));
    return Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(key, "1", CLAIM_TTL));
  }

  private static String text(Map<String, Object> event, String key) {
    return event.get(key) instanceof String s && !s.isBlank() ? s : null;
  }
}
