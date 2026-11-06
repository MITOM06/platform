package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;

import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.service.AiConstants;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class MeetingGroupMembersTest {

  private static Meeting.Attendance att(String userId) {
    return Meeting.Attendance.builder().userId(userId).displayName(userId).build();
  }

  @Test
  void hostFirstThenCoHostInviteeAttendee_deduped_withoutRemovedAndBot() {
    Meeting m =
        Meeting.builder()
            .hostId("host")
            .coHostIds(List.of("co"))
            .inviteeIds(List.of("inv", "gone"))
            .departmentId("dept-1")
            .removedIds(List.of("gone", "kicked"))
            .attendance(
                new ArrayList<>(
                    List.of(
                        att("walkin"),
                        att("walkin"), // second session of the same person
                        att("kicked"),
                        att("host"),
                        att(AiConstants.AI_BOT_USER_ID))))
            .build();

    assertThat(MeetingGroupMembers.of(m)).containsExactly("host", "co", "inv", "walkin");
  }

  @Test
  void departmentIsNeverExpanded() {
    Meeting m = Meeting.builder().hostId("host").departmentId("dept-1").build();
    assertThat(MeetingGroupMembers.of(m)).containsExactly("host");
  }
}
