package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.TokenUsageDayResponse;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.model.TokenUsage;
import com.platform.chatservice.repository.TokenUsageRepository;
import com.platform.chatservice.security.UserPrincipal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;

/** Personal token-usage dashboard: own rows only, one entry per day, zero-filled gaps. */
class UsageControllerTest {

  private static final String ME = "me-1";

  private final TokenUsageRepository repo = mock(TokenUsageRepository.class);
  private final UsageController controller = new UsageController(repo);
  private final LocalDate today = LocalDate.now();

  @BeforeEach
  void auth() {
    SecurityContextHolder.getContext().setAuthentication(new UserPrincipal(ME));
  }

  @AfterEach
  void clear() {
    SecurityContextHolder.clearContext();
  }

  private static TokenUsage row(LocalDate d, int in, int out, int n) {
    return TokenUsage.builder()
        .userId(ME)
        .date(d.toString())
        .inputTokens(in)
        .outputTokens(out)
        .requestCount(n)
        .build();
  }

  @Test
  void lastNDaysIsZeroFilledAndScopedToCaller() {
    when(repo.findUsageInRange(ME, today.minusDays(2).toString(), today.toString()))
        .thenReturn(List.of(row(today.minusDays(1), 10, 5, 2)));

    List<TokenUsageDayResponse> days = controller.getTokenUsage(3, null, null);

    assertThat(days).hasSize(3);
    assertThat(days.get(0))
        .isEqualTo(new TokenUsageDayResponse(today.minusDays(2).toString(), 0, 0, 0, 0));
    assertThat(days.get(1))
        .isEqualTo(new TokenUsageDayResponse(today.minusDays(1).toString(), 10, 5, 2, 15));
    assertThat(days.get(2).date()).isEqualTo(today.toString());
  }

  @Test
  void customRangeIsClampedToToday() {
    LocalDate from = today.minusDays(1);
    controller.getTokenUsage(30, from.toString(), today.plusDays(10).toString());
    verify(repo).findUsageInRange(ME, from.toString(), today.toString());
  }

  @Test
  void invertedRangeFallsBackToTheWeekBeforeEnd() {
    LocalDate end = today.minusDays(3);
    List<TokenUsageDayResponse> days =
        controller.getTokenUsage(30, today.toString(), end.toString());
    verify(repo).findUsageInRange(ME, end.minusDays(6).toString(), end.toString());
    assertThat(days).hasSize(7);
  }

  @Test
  void onlyOneBoundGivenUsesLastNDays() {
    controller.getTokenUsage(1, "2020-01-01", null);
    verify(repo).findUsageInRange(ME, today.toString(), today.toString());
  }

  @Test
  void anonymousIsRejected() {
    SecurityContextHolder.clearContext();
    assertThatThrownBy(() -> controller.getTokenUsage(30, null, null))
        .isInstanceOf(UnauthorizedException.class);
    verifyNoInteractions(repo);
  }

  @Test
  void negativeDaysIsAClientError() {
    // datesUntil throws IllegalArgumentException → GlobalExceptionHandler answers 400.
    assertThatThrownBy(() -> controller.getTokenUsage(-5, null, null))
        .isInstanceOf(IllegalArgumentException.class);
  }

  /** {@code ?days=100000000} / {@code startDate=0001-01-01} must not build a huge list (DoS). */
  @Test
  void hugeRangeIsCapped() {
    when(repo.findUsageInRange(eq(ME), anyString(), anyString())).thenReturn(List.of());
    assertThat(controller.getTokenUsage(5_000, null, null)).hasSize(366);
    assertThat(controller.getTokenUsage(30, "0001-01-01", today.toString())).hasSize(366);
    // Both modes keep the most recent 366 days (the custom range is anchored at its end date).
    verify(repo, times(2)).findUsageInRange(ME, today.minusDays(365).toString(), today.toString());
  }

  @Test
  void malformedDateIsBadRequest() {
    assertThatThrownBy(() -> controller.getTokenUsage(30, "yesterday", "today"))
        .isInstanceOf(BadRequestException.class)
        .extracting("code")
        .isEqualTo(ErrorCodes.INVALID_PARAMETER);
  }
}
