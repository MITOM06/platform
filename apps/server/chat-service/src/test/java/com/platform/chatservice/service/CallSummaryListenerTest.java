package com.platform.chatservice.service;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.repository.CallSessionRepository;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.DefaultMessage;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

/**
 * {@code call:summary:result} is Redis pub/sub, so EVERY chat-service instance receives it. Without
 * a claim each one saved and broadcast its own copy: N instances → N meeting summaries in the chat.
 */
class CallSummaryListenerTest {

  private AiMessageService aiMessages;
  private CallSessionRepository sessions;
  private ValueOperations<String, String> values;
  private CallSummaryListener listener;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    aiMessages = mock(AiMessageService.class);
    sessions = mock(CallSessionRepository.class);
    StringRedisTemplate redis = mock(StringRedisTemplate.class);
    values = mock(ValueOperations.class);
    when(redis.opsForValue()).thenReturn(values);
    listener = new CallSummaryListener(aiMessages, sessions, new ObjectMapper(), redis);
  }

  private DefaultMessage result(String callId) {
    String json =
        "{\"conversationId\":\"conv\",\"callId\":\""
            + callId
            + "\",\"payload\":{\"overview\":\"o\"}}";
    return new DefaultMessage(
        "call:summary:result".getBytes(StandardCharsets.UTF_8),
        json.getBytes(StandardCharsets.UTF_8));
  }

  @Test
  void onlyTheInstanceThatClaimsTheCallSavesTheSummary() {
    when(values.setIfAbsent(eq("call:summary:claim:c1"), eq("1"), eq(Duration.ofHours(1))))
        .thenReturn(true)
        .thenReturn(false);
    when(aiMessages.saveMeetingSummary(anyString(), anyString())).thenReturn("m1");

    listener.onMessage(result("c1"), null); // instance A
    listener.onMessage(result("c1"), null); // instance B, same publish

    verify(aiMessages, times(1)).saveMeetingSummary(eq("conv"), anyString());
  }

  @Test
  void aLostClaimSavesNothing() {
    when(values.setIfAbsent(anyString(), anyString(), eq(Duration.ofHours(1)))).thenReturn(false);

    listener.onMessage(result("c2"), null);

    verify(aiMessages, never()).saveMeetingSummary(anyString(), anyString());
  }
}
