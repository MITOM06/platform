package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class MeetingHostActionTest {

  @Test
  void exactlyTheMilestoneActions() {
    assertThat(Arrays.stream(MeetingHostAction.values()).map(Enum::name))
        .containsExactly(
            "MUTE_MIC",
            "MUTE_ALL",
            "REMOVE",
            "LOWER_HAND",
            "LOWER_ALL_HANDS",
            "LOCK",
            "UNLOCK",
            "WAITING_ROOM_ON",
            "WAITING_ROOM_OFF",
            "ATTENDEE_SCREEN_SHARE_ON",
            "ATTENDEE_SCREEN_SHARE_OFF",
            "MAKE_COHOST",
            "REVOKE_COHOST");
  }

  @Test
  void onlyPersonActionsNeedATarget() {
    assertThat(Arrays.stream(MeetingHostAction.values()).filter(MeetingHostAction::needsTarget))
        .containsExactlyInAnyOrder(
            MeetingHostAction.MUTE_MIC,
            MeetingHostAction.REMOVE,
            MeetingHostAction.LOWER_HAND,
            MeetingHostAction.MAKE_COHOST,
            MeetingHostAction.REVOKE_COHOST);
  }

  @Test
  void parseIsExactAndNeverThrows() {
    assertThat(MeetingHostAction.parse("LOCK")).contains(MeetingHostAction.LOCK);
    assertThat(MeetingHostAction.parse("lock")).isEmpty();
    assertThat(MeetingHostAction.parse("DROP_TABLE")).isEmpty();
    assertThat(MeetingHostAction.parse(null)).isEmpty();
  }
}
