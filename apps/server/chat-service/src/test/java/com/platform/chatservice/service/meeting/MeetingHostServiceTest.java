package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.LobbyEntryDto;
import com.platform.chatservice.dto.meeting.MeetingHostCommand;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingHostServiceTest {

  @Mock private MeetingGuard guard;
  @Mock private MeetingStore store;
  @Mock private MeetingLobby lobby;
  @Mock private MeetingHandService hands;
  @Mock private MeetingRoomPolicy policy;
  @Mock private MeetingPeople people;
  @Mock private MeetingEvents events;
  @InjectMocks private MeetingHostService host;

  private Meeting m;
  private Meeting after;
  private final UserPrincipal lan = new UserPrincipal("host");
  private final UserPrincipal minh = new UserPrincipal("co");
  private final UserPrincipal hoa = new UserPrincipal("inv");

  @BeforeEach
  void setUp() {
    Instant t = Instant.now();
    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .coHostIds(new ArrayList<>(List.of("co")))
            .inviteeIds(new ArrayList<>(List.of("inv")))
            .status(MeetingStatus.LIVE)
            .attendance(
                new ArrayList<>(
                    List.of(
                        Meeting.Attendance.builder().userId("inv").joinedAt(t).build(),
                        Meeting.Attendance.builder().userId("walkin").joinedAt(t).build())))
            .build();
    after = Meeting.builder().id("m1").hostId("host").status(MeetingStatus.LIVE).build();
    when(guard.find("m1")).thenReturn(m);
    when(store.update(eq("m1"), any())).thenReturn(Optional.of(after));
    when(people.profiles(anyCollection()))
        .thenReturn(
            Map.of(
                "host", new PersonDto("host", "Lan", null),
                "co", new PersonDto("co", "Minh", null)));
  }

  private static MeetingHostCommand cmd(String action, String target) {
    return new MeetingHostCommand("m1", action, target);
  }

  private static ApiException apiError(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e;
    }
    throw new AssertionError("expected ApiException");
  }

  private Update lastUpdate() {
    ArgumentCaptor<Update> captor = ArgumentCaptor.forClass(Update.class);
    verify(store).update(eq("m1"), captor.capture());
    return captor.getValue();
  }

  @SuppressWarnings("unchecked")
  private Predicate<String> mutePredicate() {
    ArgumentCaptor<Predicate<String>> captor = ArgumentCaptor.forClass(Predicate.class);
    verify(policy).muteMicrophones(eq("m1"), captor.capture());
    return captor.getValue();
  }

  @Test
  void anAttendeesHostCommandsAreIgnoredWithoutAWord() {
    for (MeetingHostAction a : MeetingHostAction.values()) {
      host.execute(hoa, cmd(a.name(), "walkin"));
    }
    verifyNoInteractions(store, lobby, hands, policy, events);
  }

  @Test
  void anUnknownActionOrAMissingTargetNamesTheField() {
    assertThat(apiError(() -> host.execute(lan, cmd("NUKE", null))).getParams())
        .isEqualTo(Map.of("field", "action"));
    assertThat(apiError(() -> host.execute(lan, cmd(null, null))).getParams())
        .isEqualTo(Map.of("field", "action"));
    assertThat(apiError(() -> host.execute(lan, cmd("REMOVE", " "))).getParams())
        .isEqualTo(Map.of("field", "targetId"));
  }

  @Test
  void anEndedMeetingTakesNoCommands() {
    m.setStatus(MeetingStatus.ENDED);
    ApiException e = apiError(() -> host.execute(lan, cmd("LOCK", null)));
    assertThat(e.status()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(e.code()).isEqualTo("MEETING_ENDED");
  }

  @Test
  void muteMicTargetsOnePersonAndTellsThemWhoDidIt() {
    when(policy.muteMicrophones(eq("m1"), any())).thenReturn(List.of("inv"));

    host.execute(minh, cmd("MUTE_MIC", "inv"));

    Predicate<String> who = mutePredicate();
    assertThat(who.test("inv")).isTrue();
    assertThat(who.test("walkin")).isFalse();
    verify(events).muted("m1", "inv", new PersonDto("co", "Minh", null));
  }

  @Test
  void muteAllSparesTheCallerAndANoOpMuteSaysNothing() {
    when(policy.muteMicrophones(eq("m1"), any())).thenReturn(List.of());

    host.execute(lan, cmd("MUTE_ALL", null));

    Predicate<String> who = mutePredicate();
    assertThat(who.test("host")).isFalse();
    assertThat(who.test("co")).isTrue();
    assertThat(who.test("inv")).isTrue();
    verify(events, never()).muted(anyString(), anyString(), any());
  }

  @Test
  void removeShutsEveryDoorInOrder() {
    host.execute(lan, cmd("REMOVE", "inv"));

    Document doc = lastUpdate().getUpdateObject();
    assertThat((Document) doc.get("$addToSet")).containsEntry("removedIds", "inv");
    assertThat((Document) doc.get("$pull")).containsEntry("coHostIds", "inv");
    InOrder order = inOrder(store, lobby, hands, events, policy);
    order.verify(store).update(eq("m1"), any());
    order.verify(lobby).markRemoved("m1", "inv");
    order.verify(hands).lower("m1", "inv");
    order.verify(events).removed("m1", "inv");
    order.verify(policy).kick("m1", "inv");
  }

  @Test
  void nobodyRemovesTheHostOrThemselvesAndCoHostsCannotRemoveCoHosts() {
    m.getCoHostIds().add("co2");

    assertThat(apiError(() -> host.execute(minh, cmd("REMOVE", "host"))).code())
        .isEqualTo("MEETING_FORBIDDEN");
    assertThat(apiError(() -> host.execute(minh, cmd("REMOVE", "co2"))).code())
        .isEqualTo("MEETING_FORBIDDEN");
    assertThat(apiError(() -> host.execute(lan, cmd("REMOVE", "host"))).getParams())
        .isEqualTo(Map.of("field", "targetId"));
    verify(store, never()).update(anyString(), any());
  }

  @Test
  void aRemovalStandsEvenWhenLiveKitIsDown() {
    doThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "MEETINGS_UNAVAILABLE"))
        .when(policy)
        .kick("m1", "inv");

    assertThat(apiError(() -> host.execute(lan, cmd("REMOVE", "inv"))).code())
        .isEqualTo("MEETINGS_UNAVAILABLE");
    verify(lobby).markRemoved("m1", "inv");
    verify(events).removed("m1", "inv");
  }

  @Test
  void handsAreLoweredOneOrAll() {
    host.execute(minh, cmd("LOWER_HAND", "inv"));
    host.execute(minh, cmd("LOWER_ALL_HANDS", null));

    verify(hands).lower("m1", "inv");
    verify(hands).lowerAll("m1");
  }

  @Test
  void aSettingsCommandSetsOneFieldAndAnnouncesOnlyARealChange() {
    host.execute(lan, cmd("LOCK", null));

    Document set = (Document) lastUpdate().getUpdateObject().get("$set");
    assertThat(set).containsExactlyEntriesOf(Map.of("settings.locked", true));
    verify(events).settings(after);

    m.getSettings().setLocked(true);
    host.execute(lan, cmd("LOCK", null)); // already locked
    verify(store, times(1)).update(anyString(), any());
    verify(events, times(1)).settings(any());
    verify(policy, never()).applyScreenShare(any());
  }

  @Test
  void waitingRoomOffWritesTheWaitingRoomField() {
    host.execute(minh, cmd("WAITING_ROOM_OFF", null));

    Document set = (Document) lastUpdate().getUpdateObject().get("$set");
    assertThat(set).containsExactlyEntriesOf(Map.of("settings.waitingRoom", false));
  }

  @Test
  void theScreenShareSwitchIsAppliedToTheRoom() {
    host.execute(minh, cmd("ATTENDEE_SCREEN_SHARE_OFF", null));

    Document set = (Document) lastUpdate().getUpdateObject().get("$set");
    assertThat(set).containsExactlyEntriesOf(Map.of("settings.allowAttendeeScreenShare", false));
    verify(events).settings(after);
    verify(policy).applyScreenShare(after);
  }

  @Test
  void onlyTheHostAppointsCoHostsAndOnlyFromPeopleInTheRoom() {
    assertThat(apiError(() -> host.execute(minh, cmd("MAKE_COHOST", "inv"))).code())
        .isEqualTo("MEETING_FORBIDDEN");
    assertThat(apiError(() -> host.execute(lan, cmd("MAKE_COHOST", "outside"))).getParams())
        .isEqualTo(Map.of("field", "targetId"));
    assertThat(apiError(() -> host.execute(lan, cmd("MAKE_COHOST", "host"))).getParams())
        .isEqualTo(Map.of("field", "targetId"));
    verify(store, never()).update(anyString(), any());

    List<LobbyEntryDto> waiting = List.of(new LobbyEntryDto("w1", "Wen"));
    when(lobby.waiting("m1")).thenReturn(waiting);
    host.execute(lan, cmd("MAKE_COHOST", "inv"));

    assertThat((Document) lastUpdate().getUpdateObject().get("$addToSet"))
        .containsEntry("coHostIds", "inv");
    verify(events).roster(after);
    verify(events).lobbyTo("inv", "m1", waiting);
    verify(policy).applyPublishPermission(after, "inv");
  }

  @Test
  void appointingACoHostTwiceOrRevokingSomeoneWhoIsNotOneDoesNothing() {
    host.execute(lan, cmd("MAKE_COHOST", "co"));
    host.execute(lan, cmd("REVOKE_COHOST", "inv"));

    verify(store, never()).update(anyString(), any());
    verifyNoInteractions(events);
  }

  @Test
  void aRevokedCoHostStaysAdmittedSoTheyAreNotLockedOut() {
    host.execute(lan, cmd("REVOKE_COHOST", "co"));

    assertThat((Document) lastUpdate().getUpdateObject().get("$pull"))
        .containsEntry("coHostIds", "co");
    verify(lobby).admit("m1", "co");
    verify(events).roster(after);
    verify(policy).applyPublishPermission(after, "co");
    assertThat(apiError(() -> host.execute(minh, cmd("REVOKE_COHOST", "co"))).code())
        .isEqualTo("MEETING_FORBIDDEN");
  }

  @Test
  void someoneRemovedWhileWaitingLeavesTheHostsLobbyList() {
    List<LobbyEntryDto> waiting = List.of(new LobbyEntryDto("w1", "Wen"));
    when(lobby.remove("m1", "pest")).thenReturn(true);
    when(lobby.waiting("m1")).thenReturn(waiting);

    host.execute(lan, cmd("REMOVE", "pest"));

    verify(events).lobby(after, waiting);
  }
}
