package com.platform.chatservice.service.rtc;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RtcRoomsTest {

  @Test
  void roomNamesCarryTheirDomainPrefix() {
    assertThat(RtcRooms.forCall("abc")).isEqualTo("call_abc");
    assertThat(RtcRooms.forMeeting("m1")).isEqualTo("meet_m1");
  }

  @Test
  void idOfStripsOnlyTheMatchingPrefix() {
    assertThat(RtcRooms.idOf("call_abc", RtcRooms.CALL_PREFIX)).isEqualTo("abc");
    assertThat(RtcRooms.idOf("meet_m1", RtcRooms.CALL_PREFIX)).isNull();
    assertThat(RtcRooms.idOf("call_", RtcRooms.CALL_PREFIX)).isNull();
    assertThat(RtcRooms.idOf(null, RtcRooms.CALL_PREFIX)).isNull();
  }
}
