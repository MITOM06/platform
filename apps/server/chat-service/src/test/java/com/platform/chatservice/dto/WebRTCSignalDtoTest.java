package com.platform.chatservice.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class WebRTCSignalDtoTest {

  /**
   * Jackson must bind `reason` from the inbound STOMP JSON (unknown props are silently dropped).
   */
  @Test
  void bindsReasonFromJson() throws Exception {
    WebRTCSignalDto dto =
        new ObjectMapper()
            .readValue(
                "{\"type\":\"end\",\"targetId\":\"u\",\"reason\":\"busy\"}", WebRTCSignalDto.class);
    assertThat(dto.getReason()).isEqualTo("busy");
  }
}
