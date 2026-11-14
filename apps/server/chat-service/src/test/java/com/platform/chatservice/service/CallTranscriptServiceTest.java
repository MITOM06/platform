package com.platform.chatservice.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.model.CallSession;
import com.platform.chatservice.repository.CallSessionRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

class CallTranscriptServiceTest {

  private CallSessionRepository sessions;
  private ConversationMembershipCache membership;
  private StringRedisTemplate redis;
  private ListOperations<String, String> listOps;
  private final ObjectMapper mapper = new ObjectMapper();
  private CallTranscriptService service;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    sessions = mock(CallSessionRepository.class);
    membership = mock(ConversationMembershipCache.class);
    redis = mock(StringRedisTemplate.class);
    listOps = mock(ListOperations.class);
    when(redis.opsForList()).thenReturn(listOps);
    service = new CallTranscriptService(sessions, membership, redis, mapper);
  }

  private void activeCall() {
    when(sessions.findByCallId("call-1"))
        .thenReturn(
            Optional.of(CallSession.builder().callId("call-1").conversationId("conv-1").build()));
  }

  @Test
  void append_memberOfActiveCall_pushesSegmentWithTtl() throws Exception {
    activeCall();
    when(membership.isMember("conv-1", "u1")).thenReturn(true);

    service.appendTranscript("u1", "call-1", "hello world", 1234L);

    ArgumentCaptor<String> segment = ArgumentCaptor.forClass(String.class);
    verify(listOps).rightPush(eq("call:transcript:call-1"), segment.capture());
    JsonNode json = mapper.readTree(segment.getValue());
    assertEquals("u1", json.get("userId").asText());
    assertEquals("u1", json.get("displayName").asText());
    assertEquals("hello world", json.get("text").asText());
    assertEquals(1234L, json.get("ts").asLong());
    verify(redis).expire("call:transcript:call-1", Duration.ofHours(2));
  }

  @Test
  void append_nullTimestamp_usesNow() throws Exception {
    activeCall();
    when(membership.isMember("conv-1", "u1")).thenReturn(true);
    long before = Instant.now().toEpochMilli();

    service.appendTranscript("u1", "call-1", "hi", null);

    ArgumentCaptor<String> segment = ArgumentCaptor.forClass(String.class);
    verify(listOps).rightPush(eq("call:transcript:call-1"), segment.capture());
    long ts = mapper.readTree(segment.getValue()).get("ts").asLong();
    assertTrue(ts >= before && ts <= Instant.now().toEpochMilli());
  }

  @Test
  void append_invalidInput_isIgnored() {
    service.appendTranscript("u1", null, "text", 1L);
    service.appendTranscript("u1", "call-1", null, 1L);
    service.appendTranscript("u1", "call-1", "   ", 1L);

    verifyNoInteractions(sessions, membership, redis);
  }

  @Test
  void append_nonMember_isRejected() {
    activeCall();
    when(membership.isMember("conv-1", "intruder")).thenReturn(false);

    service.appendTranscript("intruder", "call-1", "spoof", 1L);

    verify(redis, never()).opsForList();
    verify(redis, never()).expire(anyString(), any(Duration.class));
  }

  @Test
  void append_endedOrUnknownCall_isRejected() {
    when(sessions.findByCallId("ended"))
        .thenReturn(
            Optional.of(
                CallSession.builder()
                    .callId("ended")
                    .conversationId("conv-1")
                    .endedAt(Instant.now())
                    .build()));
    when(sessions.findByCallId("nope")).thenReturn(Optional.empty());
    when(membership.isMember("conv-1", "u1")).thenReturn(true);

    service.appendTranscript("u1", "ended", "late", 1L);
    service.appendTranscript("u1", "nope", "ghost", 1L);

    verify(redis, never()).opsForList();
  }

  @Test
  void append_redisFailure_isSwallowed() {
    activeCall();
    when(membership.isMember("conv-1", "u1")).thenReturn(true);
    when(listOps.rightPush(anyString(), anyString())).thenThrow(new RuntimeException("redis down"));

    service.appendTranscript("u1", "call-1", "hello", 1L);

    verify(listOps).rightPush(eq("call:transcript:call-1"), anyString());
    verify(redis, never()).expire(anyString(), any(Duration.class));
  }
}
