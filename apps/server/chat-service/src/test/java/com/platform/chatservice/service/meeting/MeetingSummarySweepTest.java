package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MeetingSummarySweepTest {

  @Mock private MeetingStore store;
  @InjectMocks private MeetingSummarySweep sweep;

  @Test
  void failsSummariesPendingForMoreThanTenMinutes() {
    Instant now = Instant.parse("2026-11-06T01:00:00Z");
    sweep.failStale(now);
    verify(store).failStaleSummaries(now.minus(Duration.ofMinutes(10)));
    assertThat(MeetingSummarySweep.STALE_AFTER).isEqualTo(Duration.ofMinutes(10));
  }
}
