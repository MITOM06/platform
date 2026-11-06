package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Duration;
import java.util.List;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingScreenFramesTest {

  private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 1, 2};
  private final ObjectMapper mapper = new ObjectMapper();
  @Mock private MeetingGuard guard;
  @Mock private MeetingStore store;
  @Mock private MeetingMaterialTrigger trigger;
  @Mock private GridFsTemplate gridFs;
  @Mock private StringRedisTemplate redis;
  @Mock private ValueOperations<String, String> ops;
  private final UserPrincipal host = new UserPrincipal("host");
  private final UserPrincipal guest = new UserPrincipal("guest");
  private MeetingScreenFrames frames;

  @BeforeEach
  void setUp() {
    when(redis.opsForValue()).thenReturn(ops);
    when(ops.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);
    when(store.claimAiScreenSlot("m1", 60)).thenReturn(MeetingStore.ClaimResult.CLAIMED);
    meeting(true, true);
    frames = new MeetingScreenFrames(guard, store, trigger, gridFs, redis, mapper, 60);
  }

  private void meeting(boolean aiNotes, boolean attendeeShare) {
    Meeting m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .settings(
                Meeting.Settings.builder()
                    .aiNotes(aiNotes)
                    .allowAttendeeScreenShare(attendeeShare)
                    .build())
            .build();
    when(guard.inRoom(any(), eq("m1"))).thenReturn(m);
  }

  private static MockMultipartFile jpeg() {
    return new MockMultipartFile("frame", "s.jpg", "image/jpeg", JPEG);
  }

  @Test
  void validFrameIsStoredWithoutRefsTicketedAndPublished() throws Exception {
    assertThat(frames.accept(host, "m1", jpeg(), null)).isTrue();

    ArgumentCaptor<Document> meta = ArgumentCaptor.forClass(Document.class);
    verify(gridFs)
        .store(any(java.io.InputStream.class), anyString(), eq("image/jpeg"), meta.capture());
    assertThat(meta.getValue().get("screenFrame")).isEqualTo(true);
    assertThat(meta.getValue().get("uploadedBy")).isEqualTo("host");
    assertThat(meta.getValue()).doesNotContainKey("refs");
    String uploadId = (String) meta.getValue().get("fileId");

    ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> val = ArgumentCaptor.forClass(String.class);
    verify(ops).set(key.capture(), val.capture(), eq(Duration.ofHours(1)));
    assertThat(key.getValue()).startsWith("meet:screen:frame:");
    JsonNode t = mapper.readTree(val.getValue());
    assertThat(t.get("meetingId").asText()).isEqualTo("m1");
    assertThat(t.get("userId").asText()).isEqualTo("host");
    assertThat(t.get("uploadId").asText()).isEqualTo(uploadId);
    assertThat(t.get("ts").asLong()).isPositive();

    String frameId = key.getValue().substring("meet:screen:frame:".length());
    verify(trigger).publishScreen("m1", frameId, uploadId, "image/jpeg", "host");
    verify(ops).setIfAbsent("meet:screen:throttle:m1:host", "1", Duration.ofSeconds(15));
  }

  @Test
  void tsIsClampedToTheLastMinute() throws Exception {
    frames.accept(host, "m1", jpeg(), 5L);
    frames.accept(host, "m1", jpeg(), System.currentTimeMillis() + 3_600_000);
    ArgumentCaptor<String> val = ArgumentCaptor.forClass(String.class);
    verify(ops, org.mockito.Mockito.times(2)).set(anyString(), val.capture(), any(Duration.class));
    long now = System.currentTimeMillis();
    for (String v : val.getAllValues()) {
      long ts = mapper.readTree(v).get("ts").asLong();
      assertThat(ts).isBetween(now - 61_000, now + 1000);
    }
  }

  @Test
  void aiOffIsSkippedWithoutTouchingThrottleOrCap() {
    meeting(false, true);
    assertThat(frames.accept(host, "m1", jpeg(), null)).isFalse();
    verify(store, never()).claimAiScreenSlot(anyString(), org.mockito.ArgumentMatchers.anyInt());
    verify(trigger, never()).noteScreenCap(anyString());
  }

  @Test
  void aSecondFrameInsideTheThrottleWindowIsSkipped() throws Exception {
    when(ops.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(false);
    assertThat(frames.accept(host, "m1", jpeg(), null)).isFalse();
    verify(store, never()).claimAiScreenSlot(anyString(), org.mockito.ArgumentMatchers.anyInt());
    verify(trigger, never()).publishScreen(any(), any(), any(), any(), any());
  }

  @Test
  void redisDownFailsClosed() throws Exception {
    when(ops.setIfAbsent(anyString(), anyString(), any(Duration.class)))
        .thenThrow(new IllegalStateException("redis down"));
    assertThat(frames.accept(host, "m1", jpeg(), null)).isFalse();
    verify(trigger, never()).publishScreen(any(), any(), any(), any(), any());
  }

  @Test
  void frameOverTheCapIsSkippedAndTheFirstOneNotesItOnce() throws Exception {
    when(store.claimAiScreenSlot("m1", 60)).thenReturn(MeetingStore.ClaimResult.CAP_REACHED_FIRST);
    assertThat(frames.accept(host, "m1", jpeg(), null)).isFalse();
    when(store.claimAiScreenSlot("m1", 60)).thenReturn(MeetingStore.ClaimResult.CAP_REACHED);
    assertThat(frames.accept(host, "m1", jpeg(), null)).isFalse();

    verify(trigger, org.mockito.Mockito.times(1)).noteScreenCap("m1");
    verify(trigger, never()).publishScreen(any(), any(), any(), any(), any());
    verify(gridFs, never())
        .store(any(java.io.InputStream.class), anyString(), anyString(), any(Document.class));
  }

  @Test
  void attendeeWithoutShareRightIsForbiddenButManagerIsNot() {
    meeting(true, false);
    assertThatThrownBy(() -> frames.accept(guest, "m1", jpeg(), null))
        .isInstanceOfSatisfying(
            ApiException.class, e -> assertThat(e.code()).isEqualTo("MEETING_FORBIDDEN"));
    assertThat(frames.accept(host, "m1", jpeg(), null)).isTrue();
  }

  @Test
  void aCallerOutsideTheRoomGetsTheGuardError() {
    when(guard.inRoom(any(), eq("m1")))
        .thenThrow(
            new ApiException(org.springframework.http.HttpStatus.FORBIDDEN, "MEETING_REMOVED"));
    assertThatThrownBy(() -> frames.accept(guest, "m1", jpeg(), null))
        .isInstanceOfSatisfying(
            ApiException.class, e -> assertThat(e.code()).isEqualTo("MEETING_REMOVED"));
  }

  @Test
  void badImagesAreInvalidOnFieldFrame() {
    List<MockMultipartFile> bad =
        List.of(
            new MockMultipartFile("frame", "s.jpg", "image/jpeg", new byte[0]),
            new MockMultipartFile("frame", "s.jpg", "image/jpeg", "not an image at all".getBytes()),
            new MockMultipartFile("frame", "s.gif", "image/gif", "GIF89a....".getBytes()),
            new MockMultipartFile("frame", "s.png", "image/png", JPEG),
            new MockMultipartFile("frame", "s.jpg", "image/jpeg", oversized()));
    for (MockMultipartFile f : bad) {
      assertThatThrownBy(() -> frames.accept(host, "m1", f, null))
          .isInstanceOfSatisfying(
              ApiException.class,
              e -> {
                assertThat(e.code()).isEqualTo("MEETING_INVALID");
                assertThat(e.getParams()).containsEntry("field", "frame");
              });
    }
    assertThatThrownBy(() -> frames.accept(host, "m1", null, null))
        .isInstanceOf(ApiException.class);
    verify(store, never()).claimAiScreenSlot(anyString(), org.mockito.ArgumentMatchers.anyInt());
  }

  private static byte[] oversized() {
    byte[] b = new byte[2 * 1024 * 1024 + 1];
    b[0] = (byte) 0xFF;
    b[1] = (byte) 0xD8;
    b[2] = (byte) 0xFF;
    return b;
  }

  @Test
  void aFailureAfterTheSlotWasTakenCleansUpAndStillAnswersAccepted() throws Exception {
    doThrow(new IllegalStateException("redis down"))
        .when(trigger)
        .publishScreen(any(), any(), any(), any(), any());

    assertThat(frames.accept(host, "m1", jpeg(), null)).isTrue();

    verify(redis).delete(org.mockito.ArgumentMatchers.startsWith("meet:screen:frame:"));
    verify(gridFs).delete(any(org.springframework.data.mongodb.core.query.Query.class));
  }
}
