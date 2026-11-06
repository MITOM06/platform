package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingAttachment;
import com.platform.chatservice.model.MeetingRecord;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;

@ExtendWith(MockitoExtension.class)
class MeetingMaterialTriggerTest {

  private final ObjectMapper mapper = new ObjectMapper();
  @Mock private MeetingStore store;
  @Mock private MeetingRecordService records;
  @Mock private StringRedisTemplate redis;

  private static final MeetingAttachment FILE =
      MeetingAttachment.builder()
          .uploadId("0a1b2c3d-0000-4000-8000-000000000001")
          .url("/api/uploads/0a1b2c3d-0000-4000-8000-000000000001")
          .name("plan.pdf")
          .size(10)
          .contentType("application/pdf")
          .build();

  private MeetingMaterialTrigger trigger() {
    return new MeetingMaterialTrigger(store, records, redis, mapper, 20);
  }

  private void meetingWith(boolean aiNotes) {
    when(store.findById("m1"))
        .thenReturn(
            Optional.of(
                Meeting.builder()
                    .id("m1")
                    .settings(Meeting.Settings.builder().aiNotes(aiNotes).build())
                    .build()));
  }

  @Test
  void publishesTheFileWhenAiNotesAreOn() throws Exception {
    meetingWith(true);
    when(store.claimAiFileSlot("m1", 20, FILE.getUploadId()))
        .thenReturn(MeetingStore.ClaimResult.CLAIMED);

    trigger().onFileSent("m1", "msg1", FILE, "u1");

    ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
    verify(redis).convertAndSend(eq("meet:material"), payload.capture());
    JsonNode json = mapper.readTree(payload.getValue());
    assertThat(json.get("meetingId").asText()).isEqualTo("m1");
    assertThat(json.get("messageId").asText()).isEqualTo("msg1");
    assertThat(json.get("uploadId").asText()).isEqualTo(FILE.getUploadId());
    assertThat(json.get("fileName").asText()).isEqualTo("plan.pdf");
    assertThat(json.get("mimeType").asText()).isEqualTo("application/pdf");
    assertThat(json.get("userId").asText()).isEqualTo("u1");
    assertThat(json.size()).isEqualTo(6);
  }

  @Test
  void publishesNothingWhenAiNotesAreOff() {
    meetingWith(false);

    trigger().onFileSent("m1", "msg1", FILE, "u1");

    verify(store, never())
        .claimAiFileSlot(anyString(), org.mockito.ArgumentMatchers.anyInt(), anyString());
    verify(redis, never()).convertAndSend(anyString(), anyString());
  }

  @Test
  void theFileOverTheCapIsNotPublishedAndTheNoticeIsWrittenOnce() {
    meetingWith(true);
    when(store.claimAiFileSlot("m1", 20, FILE.getUploadId()))
        .thenReturn(MeetingStore.ClaimResult.CAP_REACHED_FIRST)
        .thenReturn(MeetingStore.ClaimResult.CAP_REACHED);

    trigger().onFileSent("m1", "msg21", FILE, "u1");
    trigger().onFileSent("m1", "msg22", FILE, "u1");

    verify(redis, never()).convertAndSend(anyString(), anyString());
    ArgumentCaptor<MeetingRecord> rec = ArgumentCaptor.forClass(MeetingRecord.class);
    verify(records).append(rec.capture());
    assertThat(rec.getValue().getKind()).isEqualTo(MeetingRecord.Kind.FILE);
    assertThat(rec.getValue().getMeetingId()).isEqualTo("m1");
    assertThat(rec.getValue().getText()).isEqualTo("Đã đạt giới hạn file AI đọc.");
    assertThat(rec.getValue().getTs()).isNotNull();
  }

  @Test
  void aFileAlreadyHandedOverIsNeitherPublishedNorNoted() {
    meetingWith(true);
    when(store.claimAiFileSlot("m1", 20, FILE.getUploadId()))
        .thenReturn(MeetingStore.ClaimResult.ALREADY_CLAIMED);

    trigger().onFileSent("m1", "msg2", FILE, "u1");

    verify(redis, never()).convertAndSend(anyString(), anyString());
    verify(records, never()).append(any());
  }

  @Test
  void nothingEverEscapes() {
    meetingWith(true);
    when(store.claimAiFileSlot("m1", 20, FILE.getUploadId()))
        .thenReturn(MeetingStore.ClaimResult.CLAIMED);
    doThrow(new IllegalStateException("redis down"))
        .when(redis)
        .convertAndSend(anyString(), anyString());

    assertThatCode(() -> trigger().onFileSent("m1", "msg1", FILE, "u1")).doesNotThrowAnyException();
    when(store.findById(any())).thenThrow(new IllegalStateException("mongo down"));
    assertThatCode(() -> trigger().onFileSent("m2", "msg1", FILE, "u1")).doesNotThrowAnyException();
  }
}
