package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.security.UserPrincipal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingGuardTest {

  @Mock private MeetingStore store;
  @Mock private MeetingLobby lobby;
  @InjectMocks private MeetingGuard guard;
  private Meeting m;

  private final UserPrincipal host = new UserPrincipal("host");
  private final UserPrincipal invitee = new UserPrincipal("inv");
  private final UserPrincipal stranger = new UserPrincipal("stranger");

  @BeforeEach
  void setUp() {
    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .inviteeIds(new ArrayList<>(List.of("inv")))
            .build();
    when(store.findById("m1")).thenReturn(Optional.of(m));
    when(store.findById("nope")).thenReturn(Optional.empty());
  }

  private static ApiException apiError(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e;
    }
    throw new AssertionError("expected ApiException");
  }

  @Test
  void unknownAndBlankIdsAreNotFoundAndBlankNeverHitsTheDatabase() {
    assertThat(apiError(() -> guard.find(" ")).code()).isEqualTo("MEETING_NOT_FOUND");
    assertThat(apiError(() -> guard.find(null)).status()).isEqualTo(HttpStatus.NOT_FOUND);
    assertThat(apiError(() -> guard.find("nope")).code()).isEqualTo("MEETING_NOT_FOUND");
    verify(store, never()).findById(" ");
  }

  @Test
  void inRoomLetsInExactlyThePeopleWhoGetAToken() {
    assertThat(guard.inRoom(host, "m1")).isSameAs(m);
    assertThat(guard.inRoom(invitee, "m1")).isSameAs(m);

    when(lobby.isAdmitted("m1", "stranger")).thenReturn(true);
    assertThat(guard.inRoom(stranger, "m1")).isSameAs(m);
  }

  @Test
  void inRoomRefusalsCarryTheirOwnCodes() {
    ApiException waiting = apiError(() -> guard.inRoom(stranger, "m1")); // waiting room on
    assertThat(waiting.status()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(waiting.code()).isEqualTo("MEETING_FORBIDDEN");

    m.getRemovedIds().add("inv");
    assertThat(apiError(() -> guard.inRoom(invitee, "m1")).code()).isEqualTo("MEETING_REMOVED");

    m.setStatus(MeetingStatus.ENDED);
    ApiException ended = apiError(() -> guard.inRoom(host, "m1"));
    assertThat(ended.status()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(ended.code()).isEqualTo("MEETING_ENDED");
  }

  @Test
  void recordsOutliveTheMeetingButNotARemoval() {
    m.setStatus(MeetingStatus.ENDED);
    assertThat(guard.records(invitee, "m1")).isSameAs(m);
    assertThat(apiError(() -> guard.records(stranger, "m1")).code()).isEqualTo("MEETING_FORBIDDEN");

    when(lobby.isAdmitted("m1", "stranger")).thenReturn(true);
    assertThat(guard.records(stranger, "m1")).isSameAs(m);

    m.getRemovedIds().add("inv");
    assertThat(apiError(() -> guard.records(invitee, "m1")).code()).isEqualTo("MEETING_REMOVED");
  }
}
