package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.config.LiveKitProperties;
import com.platform.chatservice.dto.meeting.LobbyEntryDto;
import com.platform.chatservice.dto.meeting.MeetingJoinResponse;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.rtc.LiveKitApiException;
import com.platform.chatservice.service.rtc.LiveKitRoomClient;
import com.platform.chatservice.service.rtc.LiveKitTokenService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingJoinServiceTest {

  @Mock private LiveKitRoomClient rooms;
  @Mock private MeetingStore store;
  @Mock private MeetingLobby lobby;
  @Mock private MeetingPeople people;
  @Mock private MeetingEvents events;
  @Mock private MeetingCloser closer;
  private LiveKitProperties props;
  private MeetingJoinService service;
  private Meeting m;

  private final UserPrincipal host = new UserPrincipal("host");
  private final UserPrincipal stranger = new UserPrincipal("stranger");
  private final UserPrincipal invitee = new UserPrincipal("inv");

  @BeforeEach
  void setUp() {
    props = new LiveKitProperties();
    props.setUrl("wss://rtc.example.com");
    props.setApiKey("APIkey1");
    props.setApiSecret("0123456789abcdef0123456789abcdef");
    service =
        new MeetingJoinService(
            props, new LiveKitTokenService(props), rooms, store, lobby, people, events, closer);
    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .coHostIds(new ArrayList<>(List.of("co")))
            .inviteeIds(new ArrayList<>(List.of("inv")))
            .build();
    when(store.findById("m1")).thenReturn(Optional.of(m));
    when(people.profiles(anyCollection()))
        .thenReturn(
            Map.of(
                "host", new PersonDto("host", "Lan", "/a.png"),
                "stranger", new PersonDto("stranger", "Sam", null)));
  }

  private static ApiException apiError(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e;
    }
    throw new AssertionError("expected ApiException");
  }

  private Claims claims(MeetingJoinResponse r) {
    return Jwts.parserBuilder()
        .setSigningKey(props.signingKey())
        .build()
        .parseClaimsJws(r.token())
        .getBody();
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> video(MeetingJoinResponse r) {
    return (Map<String, Object>) claims(r).get("video", Map.class);
  }

  @Test
  void withoutLiveKitMeetingsAreUnavailableBeforeAnyLookup() {
    props.setUrl("");
    ApiException e = apiError(() -> service.join(host, "m1"));
    assertThat(e.status()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    assertThat(e.code()).isEqualTo("MEETINGS_UNAVAILABLE");
    verifyNoInteractions(store);
  }

  @Test
  void refusalsMapToTheirCodes() {
    when(store.findById("gone")).thenReturn(Optional.empty());
    assertThat(apiError(() -> service.join(host, "gone")).code()).isEqualTo("MEETING_NOT_FOUND");

    m.getRemovedIds().add("stranger");
    ApiException removed = apiError(() -> service.join(stranger, "m1"));
    assertThat(removed.status()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(removed.code()).isEqualTo("MEETING_REMOVED");
    verify(lobby, never()).add(anyString(), anyString(), any());
    m.getRemovedIds().clear();

    m.getSettings().setLocked(true);
    assertThat(apiError(() -> service.join(stranger, "m1")).code()).isEqualTo("MEETING_LOCKED");
    m.getSettings().setLocked(false);

    m.setStatus(MeetingStatus.ENDED);
    ApiException ended = apiError(() -> service.join(host, "m1"));
    assertThat(ended.status()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(ended.code()).isEqualTo("MEETING_ENDED");
  }

  @Test
  void aStrangerWaitsAndTheHostsHearAboutIt() {
    List<LobbyEntryDto> waiting = List.of(new LobbyEntryDto("stranger", "Sam"));
    when(lobby.waiting("m1")).thenReturn(waiting);

    MeetingJoinResponse r = service.join(stranger, "m1");

    assertThat(r.status()).isEqualTo("waiting");
    assertThat(r.token()).isNull();
    verify(lobby).add("m1", "stranger", "Sam");
    verify(events).lobby(m, waiting);
    verify(rooms, never()).createRoom(anyString(), anyInt(), anyInt(), anyInt());
  }

  @Test
  void askingAgainWhileWaitingDoesNotPingTheHostAgain() {
    when(lobby.isWaiting("m1", "stranger")).thenReturn(true);

    assertThat(service.join(stranger, "m1").status()).isEqualTo("waiting");

    verify(lobby, never()).add(anyString(), anyString(), any());
    verify(events, never()).lobby(any(), any());
  }

  @Test
  void theHostGetsATokenForTheMeetingRoomAndSeesWhoIsWaiting() {
    List<LobbyEntryDto> waiting = List.of(new LobbyEntryDto("stranger", "Sam"));
    when(lobby.waiting("m1")).thenReturn(waiting);

    MeetingJoinResponse r = service.join(host, "m1");

    assertThat(r.status()).isEqualTo("joined");
    assertThat(r.url()).isEqualTo("wss://rtc.example.com");
    assertThat(r.role()).isEqualTo("host");
    assertThat(claims(r).getSubject()).isEqualTo("host");
    assertThat(claims(r).get("name")).isEqualTo("Lan");
    assertThat(claims(r).get("metadata")).isEqualTo("{\"avatarUrl\":\"/a.png\"}");
    assertThat(video(r)).containsEntry("room", "meet_m1");
    verify(rooms).createRoom("meet_m1", 300, 300, 25);
    verify(events).lobbyTo("host", "m1", waiting);
  }

  @Test
  void hostAndCoHostTokensNeverCarryRoomAdminButKeepEveryMediaGrant() {
    // Moderation goes through /app/meet.host only: a roomAdmin participant token would let a
    // (co-)host — even one removed or revoked since — use LiveKit's RoomService directly.
    m.getSettings().setAllowAttendeeScreenShare(false);

    for (UserPrincipal manager : List.of(host, new UserPrincipal("co"))) {
      Map<String, Object> video = video(service.join(manager, "m1"));

      assertThat(video).doesNotContainKey("roomAdmin");
      assertThat(video)
          .containsEntry("room", "meet_m1")
          .containsEntry("roomJoin", true)
          .containsEntry("canPublish", true)
          .containsEntry("canSubscribe", true)
          .containsEntry("canPublishData", true)
          .doesNotContainKey("canPublishSources"); // screen share stays allowed for managers
    }
  }

  @Test
  void attendeesCannotShareTheirScreenWhenTheHostTurnedItOff() {
    m.getSettings().setAllowAttendeeScreenShare(false);

    MeetingJoinResponse r = service.join(invitee, "m1");

    assertThat(r.role()).isEqualTo("attendee");
    assertThat(video(r)).doesNotContainKey("roomAdmin");
    assertThat(video(r).get("canPublishSources")).isEqualTo(List.of("camera", "microphone"));
    assertThat(claims(r).containsKey("name")).isFalse(); // unknown name is left out, never the id
    verify(events, never()).lobbyTo(anyString(), anyString(), any());
  }

  @Test
  void anAdmittedPersonWalksInEvenIfTheRoomIsLockedAndLeavesTheLobby() {
    m.getSettings().setLocked(true);
    when(lobby.isAdmitted("m1", "stranger")).thenReturn(true);
    when(lobby.remove("m1", "stranger")).thenReturn(true);

    assertThat(service.join(stranger, "m1").status()).isEqualTo("joined");
    verify(events).lobby(eq(m), any());
  }

  @Test
  void theTwentySixthPersonIsTurnedAwayButSomeoneAlreadyInsideMayRejoin() {
    Instant t = Instant.now();
    for (int i = 0; i < 24; i++) {
      m.getAttendance().add(Meeting.Attendance.builder().userId("u" + i).joinedAt(t).build());
    }
    m.getAttendance().add(Meeting.Attendance.builder().userId("inv").joinedAt(t).build());

    ApiException full = apiError(() -> service.join(host, "m1"));
    assertThat(full.status()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(full.code()).isEqualTo("MEETING_FULL");
    assertThat(service.join(invitee, "m1").status()).isEqualTo("joined");
  }

  @Test
  void aLiveKitOutageWhileOpeningTheRoomIsUnavailableNotA500() {
    doThrow(new LiveKitApiException("CreateRoom", 503, null))
        .when(rooms)
        .createRoom(anyString(), anyInt(), anyInt(), anyInt());

    assertThat(apiError(() -> service.join(host, "m1")).code()).isEqualTo("MEETINGS_UNAVAILABLE");
  }

  @Test
  void admitAndDenyAreForHostsAndCoHostsAndIgnoreWhoIsNoLongerWaiting() {
    assertThat(apiError(() -> service.admit("inv", "m1", "stranger")).code())
        .isEqualTo("MEETING_FORBIDDEN");

    when(lobby.remove("m1", "stranger")).thenReturn(true);
    service.admit("co", "m1", "stranger");
    verify(lobby).admit("m1", "stranger");
    verify(events).admitted("m1", "stranger");
    verify(events).lobby(eq(m), any());

    when(lobby.remove("m1", "late")).thenReturn(false);
    service.deny("host", "m1", "late");
    verify(events, never()).denied("m1", "late");

    when(lobby.remove("m1", "pest")).thenReturn(true);
    service.deny("host", "m1", "pest");
    verify(events).denied("m1", "pest");
    verify(lobby, never()).admit("m1", "pest");
  }

  @Test
  void leavingTheLobbyUpdatesTheHosts() {
    when(lobby.remove("m1", "stranger")).thenReturn(true);
    service.leaveLobby("stranger", "m1");
    verify(events).lobby(eq(m), any());
  }

  @Test
  void endClosesTheMeetingThenDropsTheRoomAndSurvivesARoomAlreadyGone() {
    assertThat(apiError(() -> service.end("inv", "m1")).code()).isEqualTo("MEETING_FORBIDDEN");

    doThrow(new LiveKitApiException("DeleteRoom", 404, null)).when(rooms).deleteRoom("meet_m1");
    service.end("co", "m1");
    verify(closer).close("m1");
    verify(rooms).deleteRoom("meet_m1");
  }

  @Test
  void endingAnEndedMeetingIsANoOp() {
    m.setStatus(MeetingStatus.ENDED);
    service.end("host", "m1");
    verify(closer, never()).close(anyString());
    verify(rooms, never()).deleteRoom(anyString());
  }

  @Test
  void someoneWhoWalkedInIsRememberedSoLockingLaterDoesNotLockThemOut() {
    m.getSettings().setWaitingRoom(false);

    assertThat(service.join(stranger, "m1").status()).isEqualTo("joined");

    verify(lobby).admit("m1", "stranger");
  }

  @Test
  void inviteesAndManagersNeedNoAdmission() {
    service.join(invitee, "m1");
    service.join(host, "m1");

    verify(lobby, never()).admit(anyString(), anyString());
  }
}
