package com.platform.chatservice.service.meeting;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingAttachment;
import com.platform.chatservice.model.MeetingRecord;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * When AI notes are on, hands a file sent in the meeting chat to ai-service on {@code
 * meet:material} (it answers on {@code meet:material:result}). At most {@code meetings.ai.file-cap}
 * files per meeting; the first file over the cap leaves one notice line in the record. Never
 * throws: a failure here must not fail the chat send.
 */
@Slf4j
@Component
public class MeetingMaterialTrigger {

  public static final String CHANNEL = "meet:material";
  static final String CAP_NOTICE = "Đã đạt giới hạn file AI đọc.";

  private final MeetingStore store;
  private final MeetingRecordService records;
  private final StringRedisTemplate redis;
  private final ObjectMapper objectMapper;
  private final int fileCap;

  public MeetingMaterialTrigger(
      MeetingStore store,
      MeetingRecordService records,
      StringRedisTemplate redis,
      ObjectMapper objectMapper,
      @Value("${meetings.ai.file-cap:20}") int fileCap) {
    this.store = store;
    this.records = records;
    this.redis = redis;
    this.objectMapper = objectMapper;
    this.fileCap = fileCap;
  }

  public void onFileSent(
      String meetingId, String messageId, MeetingAttachment file, String senderId) {
    try {
      Meeting m = store.findById(meetingId).orElse(null);
      if (m == null || m.getSettings() == null || !m.getSettings().isAiNotes()) {
        return;
      }
      switch (store.claimAiFileSlot(meetingId, fileCap, file.getUploadId())) {
        case CLAIMED -> publish(meetingId, messageId, file, senderId);
        case CAP_REACHED_FIRST -> noteCap(meetingId);
        case CAP_REACHED, ALREADY_CLAIMED -> {}
      }
    } catch (Exception e) {
      log.warn("Could not hand file of meeting {} to the AI: {}", meetingId, e.toString());
    }
  }

  private void publish(String meetingId, String messageId, MeetingAttachment file, String userId)
      throws Exception {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("meetingId", meetingId);
    payload.put("messageId", messageId);
    payload.put("uploadId", file.getUploadId());
    payload.put("fileName", file.getName());
    payload.put("mimeType", file.getContentType());
    payload.put("userId", userId);
    redis.convertAndSend(CHANNEL, objectMapper.writeValueAsString(payload));
  }

  private void noteCap(String meetingId) {
    records.append(
        MeetingRecord.builder()
            .meetingId(meetingId)
            .kind(MeetingRecord.Kind.FILE)
            .text(CAP_NOTICE)
            .ts(Instant.now())
            .build());
  }
}
