package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.MeetingSettingsDto;
import com.platform.chatservice.dto.meeting.UpdateMeetingRequest;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.security.UserPrincipal;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.query.Update;

/** {@code PATCH} settings are written switch by switch, never as a whole sub-document. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingServiceSettingsPatchTest {

  @Mock private MeetingStore store;
  @Mock private MeetingPeople people;
  @Mock private MeetingEvents events;
  @Mock private MeetingLobby lobby;
  @Mock private MeetingRoomPolicy policy;
  private MeetingService service;
  private Meeting m;
  private final UserPrincipal host = new UserPrincipal("host");

  @BeforeEach
  void setUp() {
    service =
        new MeetingService(
            store,
            new MeetingCodeGenerator(new Random(1)),
            people,
            events,
            new MeetingMapper(people),
            lobby,
            policy);
    m = Meeting.builder().id("m1").code("abc-defg-hjk").hostId("host").build();
    when(store.findById("m1")).thenReturn(Optional.of(m));
    when(people.profiles(any())).thenReturn(Map.of());
  }

  private static UpdateMeetingRequest patch(MeetingSettingsDto settings) {
    return new UpdateMeetingRequest(null, null, null, null, null, null, settings);
  }

  private Document set() {
    ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
    verify(store).update(eq("m1"), update.capture());
    return (Document) update.getValue().getUpdateObject().get("$set");
  }

  @Test
  void onlyTheChangedSwitchesAreWrittenSoAConcurrentHostCommandSurvives() {
    // The form re-sends every switch; the host LOCKed the room after this read (stale
    // locked=false), so re-sending locked=false must not touch "settings.locked".
    when(store.update(eq("m1"), any())).thenReturn(Optional.of(m));

    service.update(host, "m1", patch(new MeetingSettingsDto(true, false, true, false, false)));

    assertThat(set()).containsExactlyEntriesOf(Map.of("settings.attendeesCanEditNotes", false));
    verify(events).settings(m);
  }

  @Test
  void aPatchThatChangesNoSwitchWritesNothing() {
    service.update(host, "m1", patch(new MeetingSettingsDto(true, false, true, true, false)));

    verify(store, never()).update(anyString(), any());
    verify(events, never()).settings(any());
  }

  @Test
  void aMeetingStoredWithoutSettingsGetsTheWholeObject() {
    m.setSettings(null);
    when(store.update(eq("m1"), any())).thenReturn(Optional.of(m));

    service.update(host, "m1", patch(new MeetingSettingsDto(null, null, null, null, true)));

    Document set = set();
    assertThat(set).containsOnlyKeys("settings");
    assertThat(((Meeting.Settings) set.get("settings")).isLocked()).isTrue();
  }
}
