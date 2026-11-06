package com.platform.chatservice.service.meeting;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.model.MeetingMessage;
import com.platform.chatservice.model.MeetingRecord;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Subscribes to {@code meet:material:result} (ai-service read a file sent in the meeting chat) and
 * adds it to the meeting record as one FILE line, attributed to whoever sent the file. Pub/sub fans
 * out to every instance, so the first one to claim {@code meet:material:done:<messageId>} writes.
 * Never throws out of {@link #onMessage}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MeetingMaterialResultListener implements MessageListener {

  public static final String CHANNEL = "meet:material:result";
  static final String CLAIM_PREFIX = "meet:material:done:";
  static final Duration CLAIM_TTL = Duration.ofHours(1);
  static final int TEXT_MAX = 6000;
  static final int SCREEN_TEXT_MAX = 1500;
  static final String UNREADABLE = "Không đọc được file này.";

  private final MeetingStore store;
  private final MongoTemplate mongo;
  private final MeetingPeople people;
  private final MeetingRecordService records;
  private final StringRedisTemplate redis;
  private final ObjectMapper objectMapper;
  private final GridFsTemplate gridFs;

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
    String messageId = text(root, "messageId");
    if (meetingId == null || messageId == null) {
      log.warn("{} missing meetingId or messageId", CHANNEL);
      return;
    }
    if ("screen".equals(text(root, "kind"))) {
      handleScreen(meetingId, messageId, root);
      return;
    }
    if (store.findById(meetingId).isEmpty()) {
      return;
    }
    MeetingMessage line = mongo.findById(messageId, MeetingMessage.class);
    if (line == null || !meetingId.equals(line.getMeetingId()) || line.getAttachment() == null) {
      return;
    }
    String claim = CLAIM_PREFIX + messageId;
    if (!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(claim, "1", CLAIM_TTL))) {
      return;
    }
    try {
      records.append(record(meetingId, line, root));
    } catch (RuntimeException e) {
      redis.delete(claim); // let a redelivery try again
      throw e;
    }
  }

  /**
   * A shared-screen frame: {@code messageId} is the frame id. Only a live Redis ticket for the same
   * meeting counts (userId / ts / upload come from it, never from the payload); no ticket ⇒ do
   * nothing. The ticket and the stored frame are removed for every status.
   */
  private void handleScreen(String meetingId, String frameId, JsonNode root) {
    String ticketKey = MeetingScreenFrames.TICKET_PREFIX + frameId;
    String raw = redis.opsForValue().get(ticketKey);
    if (raw == null) {
      return;
    }
    JsonNode ticket;
    try {
      ticket = objectMapper.readTree(raw);
    } catch (Exception e) {
      log.warn("Unreadable screen ticket {}", frameId);
      return;
    }
    if (!meetingId.equals(text(ticket, "meetingId"))) {
      return;
    }
    String claim = CLAIM_PREFIX + frameId;
    if (!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(claim, "1", CLAIM_TTL))) {
      return;
    }
    try {
      String body = "ok".equals(text(root, "status")) ? text(root, "text") : null;
      if (body != null && store.findById(meetingId).isPresent()) {
        String userId = text(ticket, "userId");
        JsonNode ts = ticket.get("ts");
        records.append(
            MeetingRecord.builder()
                .meetingId(meetingId)
                .kind(MeetingRecord.Kind.SCREEN)
                .userId(userId)
                .displayName(nameOf(userId))
                .text(cap(body, SCREEN_TEXT_MAX))
                .ts(
                    ts != null && ts.canConvertToLong()
                        ? Instant.ofEpochMilli(ts.asLong())
                        : Instant.now())
                .build());
      }
    } catch (RuntimeException e) {
      redis.delete(claim); // let a redelivery try again; ticket and frame stay
      throw e;
    }
    redis.delete(ticketKey);
    String uploadId = text(ticket, "uploadId");
    if (uploadId != null) {
      MeetingScreenFrames.deleteFrame(gridFs, uploadId);
    }
  }

  private MeetingRecord record(String meetingId, MeetingMessage line, JsonNode root) {
    String body = "ok".equals(text(root, "status")) ? text(root, "text") : null;
    return MeetingRecord.builder()
        .meetingId(meetingId)
        .kind(MeetingRecord.Kind.FILE)
        .userId(line.getSenderId())
        .displayName(nameOf(line.getSenderId()))
        .text(body == null ? UNREADABLE : cap(body, TEXT_MAX))
        .ref(line.getAttachment().getUploadId())
        .fileName(line.getAttachment().getName())
        .ts(line.getCreatedAt())
        .build();
  }

  private String nameOf(String userId) {
    if (userId == null) {
      return null;
    }
    PersonDto person = people.profiles(List.of(userId)).get(userId);
    return person == null ? null : person.displayName();
  }

  private static String cap(String s, int max) {
    if (s.length() <= max) {
      return s;
    }
    int end = max;
    if (Character.isHighSurrogate(s.charAt(end - 1))) {
      end--; // never leave half of a surrogate pair
    }
    return s.substring(0, end);
  }

  private static String text(JsonNode root, String field) {
    JsonNode n = root.get(field);
    return n != null && n.isTextual() && !n.asText().isBlank() ? n.asText() : null;
  }
}
