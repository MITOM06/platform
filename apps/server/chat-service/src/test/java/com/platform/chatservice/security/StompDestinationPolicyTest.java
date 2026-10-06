package com.platform.chatservice.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class StompDestinationPolicyTest {

  private static final String CONV = "64b7f0c2a1b2c3d4e5f60718";

  @Test
  void conversationTopics_areAllowed_andCaptureTheConversationId() {
    var message = StompDestinationPolicy.evaluateSubscribe("/topic/conversation/" + CONV);
    var typing =
        StompDestinationPolicy.evaluateSubscribe("/topic/conversation/" + CONV + "/typing");

    assertThat(message.allowed()).isTrue();
    assertThat(message.conversationId()).isEqualTo(CONV);
    assertThat(typing.allowed()).isTrue();
    assertThat(typing.conversationId()).isEqualTo(CONV);
  }

  @ParameterizedTest
  @ValueSource(strings = {"/user/queue/notifications", "/user/queue/webrtc", "/topic/presence"})
  void fixedDestinations_areAllowed_withoutMembership(String destination) {
    var decision = StompDestinationPolicy.evaluateSubscribe(destination);

    assertThat(decision.allowed()).isTrue();
    assertThat(decision.conversationId()).isNull();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "/topic/**",
        "/topic/conversation/*",
        "/topic/conversation/{conversationId}",
        "/topic/conversation/a?c",
        "/topic/conversation/../../queue/x",
        "/topic/conversation/" + CONV + "/typing/extra",
        "/topic/presence/extra",
        "/user/queue/notifications/extra",
        "/user/queue/notifications\n",
        "/topic/conversation/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "/topic/conversation/a.b",
        "/queue/notifications",
        ""
      })
  void everythingElse_isDenied(String destination) {
    assertThat(StompDestinationPolicy.evaluateSubscribe(destination).allowed()).isFalse();
  }

  @Test
  void nullDestination_isDenied() {
    assertThat(StompDestinationPolicy.evaluateSubscribe(null).allowed()).isFalse();
    assertThat(StompDestinationPolicy.isAllowedSend(null)).isFalse();
  }

  @Test
  void send_onlyToApplicationPrefix() {
    assertThat(StompDestinationPolicy.isAllowedSend("/app/chat.send")).isTrue();
    assertThat(StompDestinationPolicy.isAllowedSend("/app/call.offer")).isTrue();
    assertThat(StompDestinationPolicy.isAllowedSend("/app/")).isFalse();
    assertThat(StompDestinationPolicy.isAllowedSend("/app/../topic/x")).isFalse();
    assertThat(StompDestinationPolicy.isAllowedSend("/app/chat.*")).isFalse();
    assertThat(StompDestinationPolicy.isAllowedSend("/topic/conversation/" + CONV)).isFalse();
    assertThat(StompDestinationPolicy.isAllowedSend("/user/u/queue/notifications")).isFalse();
  }

  @Test
  void conversationIdOfTopic_onlyForConversationTopics() {
    assertThat(StompDestinationPolicy.conversationIdOfTopic("/topic/conversation/" + CONV))
        .isEqualTo(CONV);
    assertThat(
            StompDestinationPolicy.conversationIdOfTopic("/topic/conversation/" + CONV + "/typing"))
        .isEqualTo(CONV);
    assertThat(StompDestinationPolicy.conversationIdOfTopic("/topic/presence")).isNull();
    assertThat(StompDestinationPolicy.conversationIdOfTopic("/queue/notifications-userws"))
        .isNull();
    assertThat(StompDestinationPolicy.conversationIdOfTopic(null)).isNull();
  }

  /** Every destination used by web + Flutter must stay subscribable (contract guard). */
  @Test
  void allowList_coversEveryClientDestination() {
    assertThat(StompDestinationPolicy.SUBSCRIBE_ALLOW_LIST).hasSize(5);
  }
}
