package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.meeting.CreateMeetingRequest;
import com.platform.chatservice.dto.meeting.MeetingResponse;
import com.platform.chatservice.dto.meeting.MeetingSettingsDto;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.dto.meeting.UpdateMeetingRequest;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.stream.IntStream;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingServiceTest {

  private static final String U1 = "64b000000000000000000011";
  private static final String U2 = "64b000000000000000000012";

  @Mock private MeetingStore store;
  @Mock private MeetingPeople people;
  @Mock private MeetingEvents events;
  private MeetingService service;

  private final UserPrincipal host =
      new UserPrincipal("host", "Member", List.of("HOST_MEETING"), List.of("dept-a"));
  private final UserPrincipal stranger = new UserPrincipal("stranger");

  @BeforeEach
  void setUp() {
    service =
        new MeetingService(
            store,
            new MeetingCodeGenerator(new Random(1)),
            people,
            events,
            new MeetingMapper(people));
    when(store.insert(any()))
        .thenAnswer(
            inv -> {
              Meeting m = inv.getArgument(0);
              m.setId("m1");
              return m;
            });
    when(people.existingUserIds(anyCollection()))
        .thenAnswer(inv -> new HashSet<>(inv.<Collection<String>>getArgument(0)));
    when(people.profiles(anyCollection()))
        .thenReturn(Map.of("host", new PersonDto("host", "Lan", null)));
  }

  private static CreateMeetingRequest create(
      String title, List<String> invitees, Instant start, Instant end) {
    return new CreateMeetingRequest(title, null, invitees, null, start, end, null);
  }

  private static ApiException apiError(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e;
    }
    throw new AssertionError("expected ApiException");
  }

  private Meeting inserted() {
    ArgumentCaptor<Meeting> captor = ArgumentCaptor.forClass(Meeting.class);
    verify(store).insert(captor.capture());
    return captor.getValue();
  }

  // ---- create

  @Test
  void creatingNeedsTheHostMeetingCapability() {
    UserPrincipal noCap = new UserPrincipal("u", "Member", List.of(), List.of());
    ApiException e = apiError(() -> service.create(noCap, create("x", null, null, null)));
    assertThat(e.status()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(e.code()).isEqualTo("MEETING_CREATE_FORBIDDEN");
    verify(store, never()).insert(any());
  }

  @Test
  void anInstantMeetingIsScheduledWithDefaultsAndSortsByCreation() {
    MeetingResponse r = service.create(host, create("  Sync  ", null, null, null));

    Meeting m = inserted();
    assertThat(m.getHostId()).isEqualTo("host");
    assertThat(m.getTitle()).isEqualTo("Sync");
    assertThat(m.getStatus()).isEqualTo(MeetingStatus.SCHEDULED);
    assertThat(m.getScheduledStart()).isNull();
    assertThat(m.getSortAt()).isEqualTo(m.getCreatedAt()).isNotNull();
    assertThat(m.getCode()).matches("[a-z]{3}-[a-z]{4}-[a-z]{3}");
    assertThat(m.getSettings().isWaitingRoom()).isTrue();
    assertThat(m.getAttendance()).isEmpty();
    assertThat(r.viewerRole()).isEqualTo("host");
    assertThat(r.host()).isEqualTo(new PersonDto("host", "Lan", null));
    verify(events, never()).invited(any(), any(), anyCollection());
  }

  @Test
  void aBlankTitleIsStoredAsNoTitleNotAServerMadeString() {
    service.create(host, create("   ", null, null, null));
    assertThat(inserted().getTitle()).isNull();
  }

  @Test
  void aScheduledMeetingSortsByItsStart() {
    Instant start = Instant.now().plus(Duration.ofDays(1));
    service.create(host, create("Plan", null, start, start.plus(Duration.ofHours(1))));
    assertThat(inserted().getSortAt()).isEqualTo(start);
  }

  @Test
  void inviteesAreDedupedTheHostDroppedUnknownsDroppedAndInvited() {
    when(people.existingUserIds(anyCollection())).thenReturn(new HashSet<>(List.of(U1)));

    service.create(host, create("Sync", List.of(U1, U1, "host", U2), null, null));

    Meeting m = inserted();
    assertThat(m.getInviteeIds()).containsExactly(U1);
    verify(events).invited(m, "Lan", List.of(U1));
  }

  @Test
  void settingsArePartial() {
    service.create(
        host,
        new CreateMeetingRequest(
            "x",
            null,
            null,
            null,
            null,
            null,
            new MeetingSettingsDto(false, null, null, null, true)));
    Meeting.Settings s = inserted().getSettings();
    assertThat(s.isWaitingRoom()).isFalse();
    assertThat(s.isLocked()).isTrue();
    assertThat(s.isAllowAttendeeScreenShare()).isTrue();
  }

  @Test
  void invalidInputNamesTheField() {
    Instant start = Instant.now().plus(Duration.ofHours(2));
    List<String> tooMany =
        IntStream.range(0, 101).mapToObj(i -> String.format("64b0000000000000000%05d", i)).toList();
    Object[][] cases = {
      {create("x".repeat(121), null, null, null), "title", 120},
      {
        new CreateMeetingRequest("x", "d".repeat(2001), null, null, null, null, null),
        "description",
        2000
      },
      {create("x", tooMany, null, null), "inviteeIds", 100},
      {create("x", List.of("not-an-id"), null, null), "inviteeIds", null},
      {create("x", null, null, start), "scheduledEnd", null},
      {create("x", null, start, start.minusSeconds(60)), "scheduledEnd", null},
      {create("x", null, start, start.plus(Duration.ofHours(25))), "scheduledEnd", null},
      {create("x", null, Instant.now().minus(Duration.ofHours(1)), null), "scheduledStart", null},
    };
    for (Object[] c : cases) {
      ApiException e = apiError(() -> service.create(host, (CreateMeetingRequest) c[0]));
      assertThat(e.status()).isEqualTo(HttpStatus.BAD_REQUEST);
      assertThat(e.code()).isEqualTo("MEETING_INVALID");
      assertThat(e.getParams()).containsEntry("field", c[1]);
      if (c[2] != null) {
        assertThat(e.getParams()).containsEntry("max", c[2]);
      }
    }
    verify(store, never()).insert(any());
  }

  @Test
  void aDepartmentMeetingNeedsMembershipOrDepartmentManagement() {
    CreateMeetingRequest forB =
        new CreateMeetingRequest("x", null, null, "dept-b", null, null, null);
    assertThat(apiError(() -> service.create(host, forB)).code())
        .isEqualTo("MEETING_DEPARTMENT_FORBIDDEN");

    UserPrincipal manager =
        new UserPrincipal("mgr", "Admin", List.of("HOST_MEETING", "MANAGE_DEPARTMENTS"), List.of());
    service.create(manager, forB);
    assertThat(inserted().getDepartmentId()).isEqualTo("dept-b");
  }

  @Test
  void aCodeCollisionIsRetriedWithAFreshCode() {
    // doThrow/doAnswer: re-stubbing with when(store.insert(any())) would run setUp's answer on a
    // null argument.
    doThrow(new DuplicateKeyException("dup"))
        .doAnswer(inv -> inv.getArgument(0))
        .when(store)
        .insert(any());

    service.create(host, create("x", null, null, null));

    ArgumentCaptor<Meeting> captor = ArgumentCaptor.forClass(Meeting.class);
    verify(store, times(2)).insert(captor.capture());
    // the builder object is reused or rebuilt — either way the second attempt has its own code
    assertThat(captor.getAllValues().get(1).getCode()).matches("[a-z]{3}-[a-z]{4}-[a-z]{3}");
  }

  // ---- read

  private Meeting stored() {
    Meeting m =
        Meeting.builder()
            .id("m1")
            .code("abc-defg-hjk")
            .hostId("host")
            .inviteeIds(new ArrayList<>(List.of(U1)))
            .removedIds(new ArrayList<>(List.of(U2)))
            .attendance(
                new ArrayList<>(
                    List.of(Meeting.Attendance.builder().userId("host").role("host").build())))
            .build();
    when(store.findById("m1")).thenReturn(Optional.of(m));
    when(store.findByCode("abc-defg-hjk")).thenReturn(Optional.of(m));
    return m;
  }

  @Test
  void aGuestSeesOnlyWhatTheLinkPageNeeds() {
    stored();
    MeetingResponse r = service.get(stranger, "m1");

    assertThat(r.viewerRole()).isEqualTo("guest");
    assertThat(r.code()).isEqualTo("abc-defg-hjk");
    assertThat(r.host().userId()).isEqualTo("host");
    assertThat(r.invitees()).isNull();
    assertThat(r.attendance()).isNull();
    assertThat(r.removedIds()).isNull();
  }

  @Test
  void theHostSeesEverythingAndNamesAreNeverIds() {
    stored();
    MeetingResponse r = service.get(host, "m1");

    assertThat(r.viewerRole()).isEqualTo("host");
    assertThat(r.removedIds()).containsExactly(U2);
    assertThat(r.invitees()).containsExactly(new PersonDto(U1, null, null));
    assertThat(r.attendance()).hasSize(1);
  }

  @Test
  void codesAreNormalisedAndJunkNeverHitsTheDatabase() {
    stored();
    assertThat(service.getByCode(stranger, "ABCDEFGHJK").id()).isEqualTo("m1");

    assertThat(apiError(() -> service.getByCode(stranger, "../etc")).status())
        .isEqualTo(HttpStatus.NOT_FOUND);
    verify(store, never()).findByCode("../etc");
    assertThat(apiError(() -> service.get(stranger, "nope")).code()).isEqualTo("MEETING_NOT_FOUND");
  }

  @Test
  void listOverFetchesOneRowToKnowIfThereIsMore() {
    Meeting a = Meeting.builder().id("a").hostId("me").build();
    Meeting b = Meeting.builder().id("b").hostId("me").build();
    Meeting c = Meeting.builder().id("c").hostId("me").build();
    UserPrincipal me = new UserPrincipal("me", "Member", List.of(), List.of("dept-a"));
    when(store.page(eq("me"), eq(List.of("dept-a")), eq(true), isNull(), eq(3)))
        .thenReturn(List.of(a, b, c));

    PageResponse<MeetingResponse> page = service.list(me, "upcoming", null, 2);

    assertThat(page.content()).extracting(MeetingResponse::id).containsExactly("a", "b");
    assertThat(page.hasNext()).isTrue();
    assertThat(apiError(() -> service.list(me, "someday", null, 2)).getParams())
        .containsEntry("field", "scope");
    when(store.findById("gone")).thenReturn(Optional.empty());
    assertThat(service.list(me, "past", "gone", 2).content()).isEmpty();
  }

  // ---- update / cancel

  @Test
  void onlyHostAndCoHostsEditAndEndedMeetingsAreFrozen() {
    Meeting m = stored();
    UpdateMeetingRequest rename =
        new UpdateMeetingRequest("New", null, null, null, null, null, null);

    assertThat(apiError(() -> service.update(stranger, "m1", rename)).code())
        .isEqualTo("MEETING_FORBIDDEN");
    m.setStatus(MeetingStatus.ENDED);
    assertThat(apiError(() -> service.update(host, "m1", rename)).code())
        .isEqualTo("MEETING_ENDED");
  }

  @Test
  void editingWritesOnlyTheChangedFieldsAndAnnouncesWhatChanged() {
    Meeting m = stored();
    Instant start = Instant.now().plus(Duration.ofDays(2));
    Meeting after =
        Meeting.builder()
            .id("m1")
            .code("abc-defg-hjk")
            .hostId("host")
            .inviteeIds(new ArrayList<>(List.of(U1, U2)))
            .settings(Meeting.Settings.builder().locked(true).build())
            .build();
    ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
    when(store.update(eq("m1"), update.capture())).thenReturn(Optional.of(after));
    when(people.existingUserIds(anyCollection())).thenReturn(new HashSet<>(List.of(U1, U2)));

    service.update(
        host,
        "m1",
        new UpdateMeetingRequest(
            null,
            null,
            List.of(U1, U2),
            null,
            start,
            null,
            new MeetingSettingsDto(null, null, null, null, true)));

    Document set = (Document) update.getValue().getUpdateObject().get("$set");
    assertThat(set).containsKeys("inviteeIds", "scheduledStart", "sortAt", "reminded", "settings");
    assertThat(set).doesNotContainKeys("title", "description", "attendance", "status");
    assertThat(set.get("reminded")).isEqualTo(false);
    verify(events).invited(after, "Lan", List.of(U2)); // only the newcomer
    verify(events).settings(after);
  }

  @Test
  void aLiveMeetingCannotBeRescheduled() {
    stored().setStatus(MeetingStatus.LIVE);
    UpdateMeetingRequest move =
        new UpdateMeetingRequest(
            null, null, null, null, Instant.now().plus(Duration.ofDays(1)), null, null);
    assertThat(apiError(() -> service.update(host, "m1", move)).getParams())
        .containsEntry("field", "scheduledStart");
  }

  @Test
  void onlyTheHostCancelsAndOnlyBeforeAnyoneJoined() {
    Meeting m = stored();
    m.getCoHostIds().add("co");
    UserPrincipal co = new UserPrincipal("co");
    assertThat(apiError(() -> service.cancel(co, "m1")).code()).isEqualTo("MEETING_FORBIDDEN");

    when(store.markCancelled(eq("m1"), any())).thenReturn(false);
    assertThat(apiError(() -> service.cancel(host, "m1")).code())
        .isEqualTo("MEETING_NOT_CANCELLABLE");

    when(store.markCancelled(eq("m1"), any())).thenReturn(true);
    service.cancel(host, "m1");
    verify(events).cancelled("m1", List.of("co", U1)); // removed U2 and the host left out
  }
}
