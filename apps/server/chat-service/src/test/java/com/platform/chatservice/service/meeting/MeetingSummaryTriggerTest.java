package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;

@ExtendWith(MockitoExtension.class)
class MeetingSummaryTriggerTest {

  private final ObjectMapper mapper = new ObjectMapper();
  @Mock private MeetingStore store;
  @Mock private StringRedisTemplate redis;

  private MeetingSummaryTrigger trigger() {
    return new MeetingSummaryTrigger(store, redis, mapper);
  }

  private static Meeting meeting() {
    return Meeting.builder().id("m1").hostId("host").aiNotesEverEnabled(true).build();
  }

  @Test
  void requestFirstPublishesTheClaimedAttemptAndTheHost() throws Exception {
    ArgumentCaptor<String> attempt = ArgumentCaptor.forClass(String.class);
    when(store.claimSummary(eq("m1"), attempt.capture(), any())).thenReturn(true);

    assertThat(trigger().requestFirst(meeting())).isTrue();

    ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
    verify(redis).convertAndSend(eq("meet:summarize"), payload.capture());
    JsonNode json = mapper.readTree(payload.getValue());
    assertThat(json.get("meetingId").asText()).isEqualTo("m1");
    assertThat(json.get("attempt").asText()).isEqualTo(attempt.getValue());
    assertThat(json.get("requesterId").asText()).isEqualTo("host");
  }

  @Test
  void nothingIsPublishedWhenTheClaimIsRefused() {
    when(store.claimSummary(eq("m1"), anyString(), any())).thenReturn(false);

    assertThat(trigger().requestFirst(meeting())).isFalse();

    verify(redis, never()).convertAndSend(anyString(), anyString());
  }

  @Test
  void aPublishFailureIsSwallowedAndLeavesTheClaim() {
    when(store.claimSummary(eq("m1"), anyString(), any())).thenReturn(true);
    doThrow(new IllegalStateException("redis down"))
        .when(redis)
        .convertAndSend(anyString(), anyString());

    assertThat(trigger().requestFirst(meeting())).isFalse();
  }

  @Test
  void requestAgainClaimsRegenerateAndPublishes() {
    when(store.claimRegenerate(eq("m1"), anyString(), any())).thenReturn(true);

    assertThat(trigger().requestAgain(meeting())).isTrue();

    verify(redis).convertAndSend(eq("meet:summarize"), anyString());
  }
}
