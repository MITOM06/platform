package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.service.rtc.LiveKitWebhookEvent;
import com.platform.chatservice.service.rtc.LiveKitWebhookVerifier;
import com.platform.chatservice.service.rtc.RtcWebhookDispatcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class RtcWebhookControllerTest {

  private static final String BODY =
      "{\"id\":\"evt-1\",\"event\":\"participant_left\",\"createdAt\":\"1700000000\","
          + "\"room\":{\"name\":\"call_abc\",\"sid\":\"RM_1\",\"numParticipants\":1},"
          + "\"participant\":{\"identity\":\"user-1\",\"name\":\"Alice\","
          + "\"state\":\"DISCONNECTED\"}}";

  @Mock private LiveKitWebhookVerifier verifier;
  @Mock private RtcWebhookDispatcher dispatcher;
  private RtcWebhookController controller;

  @BeforeEach
  void setUp() {
    controller = new RtcWebhookController(verifier, dispatcher, new ObjectMapper());
  }

  @Test
  void unverifiedWebhookIsRejectedWithoutDispatch() {
    when(verifier.verify("forged", BODY)).thenReturn(false);

    assertThat(controller.receive("forged", BODY).getStatusCode())
        .isEqualTo(HttpStatus.UNAUTHORIZED);
    verify(dispatcher, never()).dispatch(any());
  }

  @Test
  void verifiedWebhookIsParsedAndDispatched() {
    when(verifier.verify("good", BODY)).thenReturn(true);

    assertThat(controller.receive("good", BODY).getStatusCode()).isEqualTo(HttpStatus.OK);
    ArgumentCaptor<LiveKitWebhookEvent> captor = ArgumentCaptor.forClass(LiveKitWebhookEvent.class);
    verify(dispatcher).dispatch(captor.capture());
    assertThat(captor.getValue().event()).isEqualTo("participant_left");
    assertThat(captor.getValue().room().name()).isEqualTo("call_abc");
    assertThat(captor.getValue().participant().identity()).isEqualTo("user-1");
    // protojson sends int64 as a string
    assertThat(captor.getValue().createdAt()).isEqualTo(1_700_000_000L);
    assertThat(captor.getValue().id()).isEqualTo("evt-1");
  }

  @Test
  void malformedJsonIsABadRequest() {
    when(verifier.verify("good", "{not json")).thenReturn(true);

    assertThat(controller.receive("good", "{not json").getStatusCode())
        .isEqualTo(HttpStatus.BAD_REQUEST);
    verify(dispatcher, never()).dispatch(any());
  }
}
