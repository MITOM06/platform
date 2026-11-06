package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingSummaryState;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MeetingSummarySweepTest {

  @Mock private MeetingStore store;
  @Mock private MeetingEvents events;
  @InjectMocks private MeetingSummarySweep sweep;

  @Test
  void failsSummariesPendingForMoreThanTenMinutes() {
    Instant now = Instant.parse("2026-11-06T01:00:00Z");
    when(store.failStaleSummaries(now.minus(Duration.ofMinutes(10)))).thenReturn(List.of());
    sweep.failStale(now);
    verify(store).failStaleSummaries(now.minus(Duration.ofMinutes(10)));
    assertThat(MeetingSummarySweep.STALE_AFTER).isEqualTo(Duration.ofMinutes(10));
  }

  @Test
  void tellsHostAndCoHostsOfEachMeetingItFlippedAndNoOneElse() {
    Instant now = Instant.parse("2026-11-06T01:00:00Z");
    Meeting flipped =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .coHostIds(List.of("co"))
            .summaryState(MeetingSummaryState.FAILED)
            .build();
    when(store.failStaleSummaries(now.minus(Duration.ofMinutes(10)))).thenReturn(List.of(flipped));

    sweep.failStale(now);

    verify(events).summaryReady(flipped, Set.of("host", "co"));
  }

  @Test
  void emitsNothingWhenNothingWasStale() {
    Instant now = Instant.parse("2026-11-06T01:00:00Z");
    when(store.failStaleSummaries(now.minus(Duration.ofMinutes(10)))).thenReturn(List.of());
    sweep.failStale(now);
    verify(events, never())
        .summaryReady(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
  }
}
