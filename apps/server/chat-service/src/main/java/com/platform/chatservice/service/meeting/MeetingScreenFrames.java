package com.platform.chatservice.service.meeting;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.upload.UploadRefs;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * {@code POST /api/meetings/{id}/screen-frames}: a frame of the sharer's own screen for the AI
 * record. Order: in the room → allowed to share → AI notes on → valid image → per-user throttle →
 * meeting cap → store the frame in GridFS (no refs: only the uploader and the internal key can read
 * it) → write the Redis ticket {@code meet:screen:frame:{frameId}} → publish {@code meet:material}
 * {@code kind:"screen"}. {@link MeetingMaterialResultListener} consumes the ticket and deletes the
 * frame; {@link MeetingScreenFrameSweep} removes any left behind.
 *
 * <p>Redis trouble fails closed (nothing published). A storing / publishing failure after the slot
 * was taken is logged and cleaned up best-effort; the caller still gets "accepted" — the client
 * ignores the outcome and the frame is just lost.
 */
@Slf4j
@Service
public class MeetingScreenFrames {

  public static final String TICKET_PREFIX = "meet:screen:frame:";
  static final String THROTTLE_PREFIX = "meet:screen:throttle:";
  static final Duration THROTTLE = Duration.ofSeconds(15);
  static final Duration TICKET_TTL = Duration.ofHours(1);
  static final long MAX_BYTES = 2L * 1024 * 1024;
  static final long TS_PAST_WINDOW_MS = 60_000;

  private final MeetingGuard guard;
  private final MeetingStore store;
  private final MeetingMaterialTrigger trigger;
  private final GridFsTemplate gridFs;
  private final StringRedisTemplate redis;
  private final ObjectMapper objectMapper;
  private final int screenCap;

  public MeetingScreenFrames(
      MeetingGuard guard,
      MeetingStore store,
      MeetingMaterialTrigger trigger,
      GridFsTemplate gridFs,
      StringRedisTemplate redis,
      ObjectMapper objectMapper,
      @Value("${meetings.ai.screen-cap:60}") int screenCap) {
    this.guard = guard;
    this.store = store;
    this.trigger = trigger;
    this.gridFs = gridFs;
    this.redis = redis;
    this.objectMapper = objectMapper;
    this.screenCap = screenCap;
  }

  /** {@code true} ⇒ 202 accepted; {@code false} ⇒ 204 skipped (AI off, throttled, cap reached). */
  public boolean accept(UserPrincipal caller, String meetingId, MultipartFile frame, Long ts) {
    Meeting m = guard.inRoom(caller, meetingId);
    String uid = caller.getUserId();
    Meeting.Settings settings = m.getSettings();
    if (!MeetingAccess.canManage(m, uid)
        && (settings == null || !settings.isAllowAttendeeScreenShare())) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.MEETING_FORBIDDEN);
    }
    if (settings == null || !settings.isAiNotes()) {
      return false;
    }
    byte[] bytes = read(frame);
    String mime = frame.getContentType().toLowerCase(Locale.ROOT);
    if (!throttleOpen(meetingId, uid)) {
      return false;
    }
    switch (store.claimAiScreenSlot(meetingId, screenCap)) {
      case CLAIMED -> {}
      case CAP_REACHED_FIRST -> {
        noteCap(meetingId);
        return false;
      }
      default -> {
        return false;
      }
    }
    forward(meetingId, uid, bytes, mime, ts);
    return true;
  }

  private void forward(String meetingId, String uid, byte[] bytes, String mime, Long ts) {
    String uploadId = UUID.randomUUID().toString();
    String frameId = UUID.randomUUID().toString();
    String ticketKey = TICKET_PREFIX + frameId;
    try {
      Document meta = new Document();
      meta.put("fileId", uploadId);
      meta.put("uploadedBy", uid);
      meta.put("screenFrame", true);
      meta.put("createdAt", Instant.now().toString());
      gridFs.store(new ByteArrayInputStream(bytes), uploadId, mime, meta);
      Map<String, Object> ticket = new LinkedHashMap<>();
      ticket.put("meetingId", meetingId);
      ticket.put("userId", uid);
      ticket.put("ts", clampTs(ts));
      ticket.put("uploadId", uploadId);
      redis.opsForValue().set(ticketKey, objectMapper.writeValueAsString(ticket), TICKET_TTL);
      trigger.publishScreen(meetingId, frameId, uploadId, mime, uid);
    } catch (Exception e) {
      log.warn(
          "Could not hand a screen frame of meeting {} to the AI: {}", meetingId, e.toString());
      cleanup(ticketKey, uploadId);
    }
  }

  private void cleanup(String ticketKey, String uploadId) {
    try {
      redis.delete(ticketKey);
    } catch (Exception ignored) {
      // best effort; the ticket expires on its own
    }
    try {
      deleteFrame(gridFs, uploadId);
    } catch (Exception ignored) {
      // best effort; the sweep removes it
    }
  }

  /** Deletes the screen frame {@code uploadId} — and only a screen frame. */
  static void deleteFrame(GridFsTemplate gridFs, String uploadId) {
    gridFs.delete(
        new Query(
            new Criteria()
                .andOperator(
                    UploadRefs.fileCriteria(Set.of(uploadId)),
                    Criteria.where("metadata.screenFrame").is(true))));
  }

  private boolean throttleOpen(String meetingId, String uid) {
    try {
      return Boolean.TRUE.equals(
          redis.opsForValue().setIfAbsent(THROTTLE_PREFIX + meetingId + ":" + uid, "1", THROTTLE));
    } catch (Exception e) {
      log.warn("Screen-frame throttle unavailable, skipping the frame: {}", e.toString());
      return false; // fail closed
    }
  }

  private void noteCap(String meetingId) {
    try {
      trigger.noteScreenCap(meetingId);
    } catch (Exception e) {
      log.warn("Could not write the screen cap notice of meeting {}: {}", meetingId, e.toString());
    }
  }

  private static long clampTs(Long ts) {
    long now = System.currentTimeMillis();
    return ts == null ? now : Math.max(now - TS_PAST_WINDOW_MS, Math.min(ts, now));
  }

  private static byte[] read(MultipartFile frame) {
    String type = frame == null ? null : frame.getContentType();
    if (frame == null || frame.isEmpty() || frame.getSize() > MAX_BYTES || type == null) {
      throw MeetingRequests.invalid("frame");
    }
    String mime = type.toLowerCase(Locale.ROOT);
    try {
      byte[] b = frame.getBytes();
      boolean jpeg = mime.equals("image/jpeg") && starts(b, 0xFF, 0xD8, 0xFF);
      boolean png = mime.equals("image/png") && starts(b, 0x89, 0x50, 0x4E, 0x47);
      if (b.length > MAX_BYTES || !(jpeg || png)) {
        throw MeetingRequests.invalid("frame");
      }
      return b;
    } catch (IOException e) {
      throw MeetingRequests.invalid("frame");
    }
  }

  private static boolean starts(byte[] b, int... sig) {
    if (b.length < sig.length) {
      return false;
    }
    for (int i = 0; i < sig.length; i++) {
      if ((b[i] & 0xFF) != sig[i]) {
        return false;
      }
    }
    return true;
  }
}
