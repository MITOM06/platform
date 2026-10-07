package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;

import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.service.meeting.MeetingAccess.Decision;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class MeetingAccessTest {

  private Meeting m;

  @BeforeEach
  void setUp() {
    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .coHostIds(new ArrayList<>(List.of("co")))
            .inviteeIds(new ArrayList<>(List.of("inv")))
            .departmentId("dept-a")
            .build();
  }

  private Decision decide(String userId, List<String> depts, boolean admitted) {
    return MeetingAccess.decide(m, userId, depts, admitted);
  }

  @Test
  void defaultsAreScheduledWithAWaitingRoom() {
    assertThat(m.getStatus()).isEqualTo(MeetingStatus.SCHEDULED);
    assertThat(m.getSettings().isWaitingRoom()).isTrue();
    assertThat(m.getSettings().isLocked()).isFalse();
    assertThat(m.getSettings().isAllowAttendeeScreenShare()).isTrue();
  }

  @Test
  void endedMeetingsAdmitNobodyNotEvenTheHost() {
    m.setStatus(MeetingStatus.ENDED);
    assertThat(decide("host", List.of(), false)).isEqualTo(Decision.DENIED_ENDED);
    assertThat(decide("inv", List.of(), true)).isEqualTo(Decision.DENIED_ENDED);
  }

  @Test
  void removedPeopleStayOutEvenIfInvitedOrAdmitted() {
    m.getRemovedIds().add("inv");
    assertThat(decide("inv", List.of("dept-a"), true)).isEqualTo(Decision.DENIED_REMOVED);
  }

  @Test
  void hostAndCoHostEnterEvenWhenLocked() {
    m.getSettings().setLocked(true);
    assertThat(decide("host", List.of(), false)).isEqualTo(Decision.HOST);
    assertThat(decide("co", List.of(), false)).isEqualTo(Decision.COHOST);
  }

  @Test
  void inviteesDepartmentMembersAndAdmittedPeopleEnterDirectlyEvenWhenLocked() {
    m.getSettings().setLocked(true);
    assertThat(decide("inv", List.of(), false)).isEqualTo(Decision.INVITED);
    assertThat(decide("stranger", List.of("dept-b", "dept-a"), false)).isEqualTo(Decision.INVITED);
    assertThat(decide("stranger", List.of(), true)).isEqualTo(Decision.INVITED);
  }

  @Test
  void othersAreRefusedWhenLocked() {
    m.getSettings().setLocked(true);
    assertThat(decide("stranger", List.of("dept-b"), false)).isEqualTo(Decision.DENIED_LOCKED);
  }

  @Test
  void othersWaitWhenTheWaitingRoomIsOnAndWalkInWhenItIsOff() {
    assertThat(decide("stranger", List.of(), false)).isEqualTo(Decision.MUST_WAIT);
    m.getSettings().setWaitingRoom(false);
    assertThat(decide("stranger", List.of(), false)).isEqualTo(Decision.INVITED);
  }

  @Test
  void aMeetingWithoutDepartmentDoesNotMatchAnEmptyDepartmentList() {
    m.setDepartmentId(null);
    assertThat(decide("stranger", List.of(), false)).isEqualTo(Decision.MUST_WAIT);
  }

  @Test
  void nullCollectionsAreTreatedAsEmpty() {
    assertThat(MeetingAccess.decide(m, "stranger", null, false)).isEqualTo(Decision.MUST_WAIT);
  }

  @ParameterizedTest
  @EnumSource(Decision.class)
  void onlyHostCoHostAndInvitedEnterTheRoom(Decision d) {
    assertThat(d.entersRoom())
        .isEqualTo(d == Decision.HOST || d == Decision.COHOST || d == Decision.INVITED);
  }

  @Test
  void rolesAndViewerRoles() {
    assertThat(MeetingAccess.roleOf(m, "host")).isEqualTo("host");
    assertThat(MeetingAccess.roleOf(m, "co")).isEqualTo("cohost");
    assertThat(MeetingAccess.roleOf(m, "inv")).isEqualTo("attendee");
    assertThat(MeetingAccess.canManage(m, "co")).isTrue();
    assertThat(MeetingAccess.canManage(m, "inv")).isFalse();

    assertThat(MeetingAccess.viewerRole(m, "host", List.of())).isEqualTo("host");
    assertThat(MeetingAccess.viewerRole(m, "co", List.of())).isEqualTo("cohost");
    assertThat(MeetingAccess.viewerRole(m, "inv", List.of())).isEqualTo("invited");
    assertThat(MeetingAccess.viewerRole(m, "x", List.of("dept-a"))).isEqualTo("invited");
    assertThat(MeetingAccess.viewerRole(m, "x", List.of())).isEqualTo("guest");

    m.getAttendance()
        .add(
            Meeting.Attendance.builder()
                .userId("x")
                .role("attendee")
                .joinedAt(Instant.now())
                .build());
    assertThat(MeetingAccess.viewerRole(m, "x", List.of())).isEqualTo("invited");
  }
}
