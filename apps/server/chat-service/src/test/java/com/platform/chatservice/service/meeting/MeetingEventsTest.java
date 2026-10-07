package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.platform.chatservice.dto.meeting.LobbyEntryDto;
import com.platform.chatservice.dto.meeting.MeetingEventDto;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.FcmService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class MeetingEventsTest {

  private ClusterMessageBroker broker;
  private FcmService fcm;
  private MeetingEvents events;
  private Meeting m;

  @BeforeEach
  void setUp() {
    broker = mock(ClusterMessageBroker.class);
    fcm = mock(FcmService.class);
    events = new MeetingEvents(broker, fcm);
    m =
        Meeting.builder()
            .id("m1")
            .code("abc-defg-hjk")
            .title("Sync")
            .hostId("host")
            .coHostIds(new ArrayList<>(List.of("co")))
            .scheduledStart(Instant.parse("2026-10-08T02:00:00Z"))
            .build();
  }

  private MeetingEventDto toTopic() {
    ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
    verify(broker).convertAndSend(eq("/topic/meeting/m1"), captor.capture());
    return (MeetingEventDto) captor.getValue();
  }

  private List<MeetingEventDto> toUser(String userId) {
    ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
    verify(broker, org.mockito.Mockito.atLeast(0))
        .convertAndSendToUser(eq(userId), eq("/queue/meeting"), captor.capture());
    return captor.getAllValues().stream().map(MeetingEventDto.class::cast).toList();
  }

  private static Meeting.Attendance row(String userId, String name, Instant joined, Instant left) {
    return Meeting.Attendance.builder()
        .userId(userId)
        .displayName(name)
        .role("attendee")
        .joinedAt(joined)
        .leftAt(left)
        .build();
  }

  @Test
  void rosterListsOnlyPeopleStillInTheRoomOncePerPerson() {
    Instant t = Instant.parse("2026-10-08T02:00:00Z");
    m.getAttendance().add(row("a", "An", t, t.plusSeconds(60)));
    m.getAttendance().add(row("a", "An", t.plusSeconds(120), null));
    m.getAttendance().add(row("b", null, t, null));
    m.getAttendance().add(row("c", "Chi", t, t.plusSeconds(5)));

    events.roster(m);

    MeetingEventDto e = toTopic();
    assertThat(e.getEvent()).isEqualTo("meet.roster");
    assertThat(e.getMeetingId()).isEqualTo("m1");
    assertThat(e.getParticipants())
        .extracting(p -> p.userId() + "@" + p.joinedAt())
        .containsExactlyInAnyOrder("a@" + t.plusSeconds(120), "b@" + t);
  }

  @Test
  void lobbyGoesToTheHostAndEveryCoHostOnly() {
    events.lobby(m, List.of(new LobbyEntryDto("w1", "Wen")));

    assertThat(toUser("host"))
        .singleElement()
        .satisfies(
            e -> {
              assertThat(e.getEvent()).isEqualTo("meet.lobby");
              assertThat(e.getWaiting()).containsExactly(new LobbyEntryDto("w1", "Wen"));
            });
    assertThat(toUser("co")).hasSize(1);
    assertThat(toUser("w1")).isEmpty();
  }

  @Test
  void endedReachesTheRoomAndThePeopleStillWaiting() {
    events.ended("m1", List.of("w1"));

    assertThat(toTopic().getEvent()).isEqualTo("meet.ended");
    assertThat(toUser("w1"))
        .singleElement()
        .satisfies(
            e -> {
              assertThat(e.getEvent()).isEqualTo("meet.ended");
              assertThat(e.getMeetingId()).isEqualTo("m1");
            });
  }

  @Test
  void invitesArePushedOnlyToOfflineDevicesAndRemindersAlways() {
    events.invited(m, "Lan", List.of("u1"));
    events.starting(m, List.of("u1"));

    assertThat(toUser("u1"))
        .extracting(MeetingEventDto::getEvent)
        .containsExactly("meet.invited", "meet.starting");
    assertThat(toUser("u1").get(0).getHostName()).isEqualTo("Lan");
    assertThat(toUser("u1").get(0).getCode()).isEqualTo("abc-defg-hjk");
    verify(fcm).sendMeetingPush("u1", "MEETING_INVITED", "m1", "abc-defg-hjk", "Sync", true);
    verify(fcm).sendMeetingPush("u1", "MEETING_STARTING", "m1", "abc-defg-hjk", "Sync", false);
  }

  @Test
  void oneFailingPushDoesNotStopTheOthers() {
    doThrow(new RuntimeException("boom"))
        .when(fcm)
        .sendMeetingPush(eq("u1"), anyString(), anyString(), anyString(), anyString(), eq(false));

    events.starting(m, List.of("u1", "u2"));

    verify(fcm).sendMeetingPush("u2", "MEETING_STARTING", "m1", "abc-defg-hjk", "Sync", false);
    assertThat(toUser("u2")).hasSize(1);
  }

  @Test
  void noPayloadEverCarriesTheLiveKitRoomName() {
    events.roster(m);
    assertThat(toTopic().toString()).doesNotContain("meet_m1");
    verify(fcm, never())
        .sendMeetingPush(anyString(), anyString(), anyString(), anyString(), anyString(), eq(true));
  }
}
