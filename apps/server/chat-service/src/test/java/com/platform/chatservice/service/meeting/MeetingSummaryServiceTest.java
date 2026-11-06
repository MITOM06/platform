package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.MeetingSummaryResponse;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.model.MeetingSummaryDoc;
import com.platform.chatservice.model.MeetingSummaryState;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
class MeetingSummaryServiceTest {

  @Mock private MeetingGuard guard;
  @Mock private MeetingSummaryStore summaries;
  @Mock private MeetingSummaryTrigger trigger;
  @Mock private ConversationRepository conversations;
  @InjectMocks private MeetingSummaryService service;

  private final UserPrincipal host = new UserPrincipal("host");
  private final UserPrincipal absent = new UserPrincipal("absent");
  private final UserPrincipal outsider = new UserPrincipal("out");
  private final UserPrincipal attendee = new UserPrincipal("att");
  private final Instant at = Instant.parse("2026-11-06T01:00:00Z");
  private Meeting m;

  @BeforeEach
  void setUp() {
    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .coHostIds(new ArrayList<>())
            .inviteeIds(new ArrayList<>(List.of("absent", "att")))
            .status(MeetingStatus.ENDED)
            .aiNotesEverEnabled(true)
            .summaryState(MeetingSummaryState.DONE)
            .groupConversationId("g1")
            .build();
    when(guard.records(host, "m1")).thenReturn(m);
    when(guard.records(absent, "m1")).thenReturn(m);
    when(guard.records(attendee, "m1")).thenReturn(m);
    when(guard.records(outsider, "m1"))
        .thenThrow(new ApiException(HttpStatus.FORBIDDEN, "MEETING_FORBIDDEN"));
    when(summaries.latest("m1"))
        .thenReturn(
            Optional.of(
                MeetingSummaryDoc.builder()
                    .meetingId("m1")
                    .status(MeetingSummaryState.DONE)
                    .summary(Map.of("overview", "o"))
                    .createdAt(at)
                    .build()));
    when(conversations.findById("g1"))
        .thenReturn(
            Optional.of(
                Conversation.builder().id("g1").participants(List.of("host", "att")).build()));
  }

  private static ApiException error(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e;
    }
    throw new AssertionError("expected ApiException");
  }

  @Test
  void anOutsiderIsRefusedByTheReadGuard() {
    ApiException e = error(() -> service.get(outsider, "m1"));
    assertThat(e.getCode()).isEqualTo("MEETING_FORBIDDEN");
  }

  @Test
  void anInvitedAbsenteeReadsTheSummaryButIsNotInTheGroup() {
    MeetingSummaryResponse r = service.get(absent, "m1");
    assertThat(r.state()).isEqualTo("DONE");
    assertThat(r.summary()).containsEntry("overview", "o");
    assertThat(r.createdAt()).isEqualTo(at);
    assertThat(r.inGroup()).isFalse();
    assertThat(r.groupConversationId()).isNull();
  }

  @Test
  void aGroupMemberGetsTheGroupId() {
    MeetingSummaryResponse r = service.get(attendee, "m1");
    assertThat(r.inGroup()).isTrue();
    assertThat(r.groupConversationId()).isEqualTo("g1");
  }

  @Test
  void aMeetingWithoutAiAnswersNullState() {
    m.setAiNotesEverEnabled(false);
    m.setSummaryState(null);
    m.setGroupConversationId(null);
    when(summaries.latest("m1")).thenReturn(Optional.empty());
    MeetingSummaryResponse r = service.get(host, "m1");
    assertThat(r.state()).isNull();
    assertThat(r.inGroup()).isFalse();
    assertThat(r.summary()).isNull();
  }

  @Test
  void anEndedAiMeetingWithNoSummaryStateReportsFailed() {
    m.setSummaryState(null);
    when(summaries.latest("m1")).thenReturn(Optional.empty());
    assertThat(service.get(host, "m1").state()).isEqualTo("FAILED");
  }

  @Test
  void aLiveAiMeetingWithNoSummaryStateStaysNull() {
    m.setSummaryState(null);
    m.setStatus(MeetingStatus.LIVE);
    when(summaries.latest("m1")).thenReturn(Optional.empty());
    assertThat(service.get(host, "m1").state()).isNull();
  }

  @Test
  void regenerateIsAcceptedWhenNoSummaryStateWasEverSet() {
    m.setSummaryState(null);
    when(trigger.regenerate(m)).thenReturn(MeetingSummaryTrigger.Result.PUBLISHED);
    assertThat(service.regenerate(host, "m1").state()).isEqualTo("PENDING");
  }

  @Test
  void aFailedStateWithAnOlderDocStillReportsFailedFromTheMeeting() {
    m.setSummaryState(MeetingSummaryState.FAILED);
    assertThat(service.get(host, "m1").state()).isEqualTo("FAILED");
  }

  @Test
  void anAttendeeCannotRegenerate() {
    ApiException e = error(() -> service.regenerate(attendee, "m1"));
    assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(e.getCode()).isEqualTo("MEETING_FORBIDDEN");
    verify(trigger, never()).regenerate(m);
  }

  @Test
  void anUnfinishedOrNeverAiMeetingIsUnavailable() {
    m.setStatus(MeetingStatus.LIVE);
    assertThat(error(() -> service.regenerate(host, "m1")).getCode())
        .isEqualTo("MEETING_SUMMARY_UNAVAILABLE");
    m.setStatus(MeetingStatus.ENDED);
    m.setAiNotesEverEnabled(false);
    ApiException e = error(() -> service.regenerate(host, "m1"));
    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(e.getCode()).isEqualTo("MEETING_SUMMARY_UNAVAILABLE");
  }

  @Test
  void aPendingSummaryIsAConflict() {
    m.setSummaryState(MeetingSummaryState.PENDING);
    ApiException e = error(() -> service.regenerate(host, "m1"));
    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(e.getCode()).isEqualTo("MEETING_SUMMARY_PENDING");
    verify(trigger, never()).regenerate(m);
  }

  @Test
  void aLostClaimRaceIsPending() {
    // claim refused: the state is no longer what we read, so a concurrent request owns it
    when(trigger.regenerate(m)).thenReturn(MeetingSummaryTrigger.Result.REFUSED);
    assertThat(error(() -> service.regenerate(host, "m1")).getCode())
        .isEqualTo("MEETING_SUMMARY_PENDING");
  }

  @Test
  void regenerateAnswersPending() {
    when(trigger.regenerate(m)).thenReturn(MeetingSummaryTrigger.Result.PUBLISHED);
    assertThat(service.regenerate(host, "m1").state()).isEqualTo("PENDING");
  }

  @Test
  void aFailedPublishStillAnswersPendingSoTheSweepCanFailIt() {
    when(trigger.regenerate(m)).thenReturn(MeetingSummaryTrigger.Result.PUBLISH_FAILED);
    assertThat(service.regenerate(host, "m1").state()).isEqualTo("PENDING");
  }
}
