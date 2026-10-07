package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.service.rtc.LiveKitApiException;
import com.platform.chatservice.service.rtc.LiveKitRoomClient;
import com.platform.chatservice.service.rtc.LiveKitRoomClient.RoomParticipant;
import com.platform.chatservice.service.rtc.LiveKitRoomClient.RoomTrack;
import com.platform.chatservice.service.rtc.LiveKitUnavailableException;
import java.util.ArrayList;
import java.util.List;
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
class MeetingRoomPolicyTest {

  private static final String ROOM = "meet_m1";
  private static final List<String> RESTRICTED = List.of("camera", "microphone");
  private static final List<String> EVERY =
      List.of("camera", "microphone", "screen_share", "screen_share_audio");

  @Mock private LiveKitRoomClient rooms;
  @InjectMocks private MeetingRoomPolicy policy;
  private Meeting m;

  @BeforeEach
  void setUp() {
    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .coHostIds(new ArrayList<>(List.of("co")))
            .inviteeIds(new ArrayList<>(List.of("inv")))
            .status(MeetingStatus.LIVE)
            .build();
    when(rooms.listParticipants(ROOM))
        .thenReturn(
            List.of(
                new RoomParticipant(
                    "host", "Lan", List.of(new RoomTrack("TR_hs", "SCREEN_SHARE", false))),
                new RoomParticipant("co", "Minh", List.of()),
                new RoomParticipant(
                    "inv",
                    "Hoa",
                    List.of(
                        new RoomTrack("TR_im", "MICROPHONE", false),
                        new RoomTrack("TR_is", "SCREEN_SHARE", false),
                        new RoomTrack("TR_ia", "SCREEN_SHARE_AUDIO", true))),
                new RoomParticipant(
                    "walkin", null, List.of(new RoomTrack("TR_wm", "MICROPHONE", true)))));
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
  void sharingOffRestrictsEveryAttendeeStopsTheirLiveShareAndLeavesManagersAlone() {
    m.getSettings().setAllowAttendeeScreenShare(false);

    policy.applyScreenShare(m);

    verify(rooms).updateParticipant(ROOM, "inv", RESTRICTED);
    verify(rooms).updateParticipant(ROOM, "walkin", RESTRICTED);
    verify(rooms, never()).updateParticipant(eq(ROOM), eq("host"), anyList());
    verify(rooms, never()).updateParticipant(eq(ROOM), eq("co"), anyList());
    verify(rooms).mutePublishedTrack(ROOM, "inv", "TR_is", true);
    verify(rooms, never()).mutePublishedTrack(ROOM, "inv", "TR_im", true); // mic untouched
    verify(rooms, never()).mutePublishedTrack(ROOM, "inv", "TR_ia", true); // already muted
    verify(rooms, never()).mutePublishedTrack(ROOM, "host", "TR_hs", true);
  }

  @Test
  void sharingOnGivesEveryAttendeeEverySourceAndMutesNothing() {
    policy.applyScreenShare(m);

    verify(rooms).updateParticipant(ROOM, "inv", EVERY);
    verify(rooms).updateParticipant(ROOM, "walkin", EVERY);
    verify(rooms, never()).mutePublishedTrack(anyString(), anyString(), anyString(), anyBoolean());
  }

  @Test
  void aLiveKitOutageIsMeetingsUnavailable() {
    // doThrow, not when(...): re-stubbing with when() would call the already-throwing stub.
    doThrow(new LiveKitUnavailableException()).when(rooms).listParticipants(ROOM);
    ApiException e = apiError(() -> policy.applyScreenShare(m));
    assertThat(e.status()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    assertThat(e.code()).isEqualTo("MEETINGS_UNAVAILABLE");

    doThrow(new LiveKitApiException("List", 500, null)).when(rooms).listParticipants(ROOM);
    assertThat(apiError(() -> policy.muteMicrophones("m1", id -> true)).code())
        .isEqualTo("MEETINGS_UNAVAILABLE");
  }

  @Test
  void aPatchThatFlipsSharingInALiveMeetingIsAppliedBestEffort() {
    Meeting before = Meeting.builder().id("m1").status(MeetingStatus.LIVE).build();
    m.getSettings().setAllowAttendeeScreenShare(false);
    doThrow(new LiveKitApiException("UpdateParticipant", 503, null))
        .when(rooms)
        .updateParticipant(anyString(), anyString(), anyList());

    assertThatCode(() -> policy.afterSettingsChange(before, m)).doesNotThrowAnyException();
    verify(rooms).listParticipants(ROOM);
  }

  @Test
  void aPatchThatLeavesSharingAloneOrAMeetingNotLiveCostsNoLiveKitCall() {
    Meeting before = Meeting.builder().id("m1").status(MeetingStatus.LIVE).build();
    policy.afterSettingsChange(before, m); // both allow sharing

    m.setStatus(MeetingStatus.SCHEDULED);
    m.getSettings().setAllowAttendeeScreenShare(false);
    policy.afterSettingsChange(before, m);

    verifyNoInteractions(rooms);
  }

  @Test
  void aRoleChangeFollowsTheNewRoleOnlyWhileSharingIsOff() {
    policy.applyPublishPermission(m, "inv"); // sharing on ⇒ nothing to change
    verifyNoInteractions(rooms);

    m.getSettings().setAllowAttendeeScreenShare(false);
    m.getCoHostIds().add("inv");
    policy.applyPublishPermission(m, "inv");
    verify(rooms).updateParticipant(ROOM, "inv", EVERY);

    m.getCoHostIds().remove("inv");
    policy.applyPublishPermission(m, "inv");
    verify(rooms).updateParticipant(ROOM, "inv", RESTRICTED);
    verify(rooms).mutePublishedTrack(ROOM, "inv", "TR_is", true);
  }

  @Test
  void aRemovedPersonIsKickedOnArrivalEvenIfLiveKitHiccups() {
    m.getRemovedIds().add("inv");
    doThrow(new LiveKitApiException("RemoveParticipant", 503, null))
        .when(rooms)
        .removeParticipant(ROOM, "inv");

    assertThat(policy.admitOnJoin(m, "inv")).isFalse();
    verify(rooms).removeParticipant(ROOM, "inv");
  }

  @Test
  void anAttendeeArrivingWhileSharingIsOffIsRestrictedOnArrival() {
    m.getSettings().setAllowAttendeeScreenShare(false);

    assertThat(policy.admitOnJoin(m, "inv")).isTrue();
    assertThat(policy.admitOnJoin(m, "host")).isTrue();

    verify(rooms).updateParticipant(ROOM, "inv", RESTRICTED);
    verify(rooms, never()).updateParticipant(eq(ROOM), eq("host"), anyList());
  }

  @Test
  void arrivingWhileSharingIsAllowedCostsNoLiveKitCall() {
    assertThat(policy.admitOnJoin(m, "inv")).isTrue();
    verifyNoInteractions(rooms);
  }

  @Test
  void kickingSomeoneAlreadyGoneIsDoneButAnOutageIsReported() {
    doThrow(new LiveKitApiException("RemoveParticipant", 404, null))
        .when(rooms)
        .removeParticipant(ROOM, "gone");
    assertThatCode(() -> policy.kick("m1", "gone")).doesNotThrowAnyException();

    doThrow(new LiveKitApiException("RemoveParticipant", 503, null))
        .when(rooms)
        .removeParticipant(ROOM, "inv");
    assertThat(apiError(() -> policy.kick("m1", "inv")).code()).isEqualTo("MEETINGS_UNAVAILABLE");
  }

  @Test
  void muteMicrophonesMutesOnlyLiveMicsOfTheChosenPeople() {
    List<String> muted = policy.muteMicrophones("m1", id -> !id.equals("host"));

    assertThat(muted).containsExactly("inv"); // walkin's mic was already muted
    verify(rooms).mutePublishedTrack(ROOM, "inv", "TR_im", true);
    verify(rooms, never()).mutePublishedTrack(ROOM, "walkin", "TR_wm", true);
    verify(rooms, never()).mutePublishedTrack(ROOM, "inv", "TR_is", true); // not a microphone
  }
}
