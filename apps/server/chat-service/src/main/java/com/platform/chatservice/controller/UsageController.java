package com.platform.chatservice.controller;

import com.platform.chatservice.dto.TokenUsageDayResponse;
import com.platform.chatservice.exception.BadRequestException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.model.TokenUsage;
import com.platform.chatservice.repository.TokenUsageRepository;
import com.platform.chatservice.security.UserPrincipal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/usage")
@RequiredArgsConstructor
public class UsageController {

  /** Longest window one request may span — bounds the zero-filled list built in memory. */
  private static final int MAX_DAYS = 366;

  private final TokenUsageRepository tokenUsageRepository;

  @GetMapping("/tokens")
  public List<TokenUsageDayResponse> getTokenUsage(
      @RequestParam(defaultValue = "30") int days,
      @RequestParam(required = false) String startDate,
      @RequestParam(required = false) String endDate) {
    final String userId = currentUserId();
    final DateTimeFormatter fmt = DateTimeFormatter.ISO_LOCAL_DATE;
    final LocalDate today = LocalDate.now();

    LocalDate toDate;
    LocalDate fromDate;

    if (startDate != null && endDate != null) {
      // Custom range mode. Clamp to today, guard against inverted ranges, cap the span.
      fromDate = parseDate("startDate", startDate, fmt);
      toDate = parseDate("endDate", endDate, fmt);
      if (toDate.isAfter(today)) {
        toDate = today;
      }
      if (fromDate.isAfter(toDate)) {
        fromDate = toDate.minusDays(6);
      }
      LocalDate earliest = toDate.minusDays(MAX_DAYS - 1L);
      if (fromDate.isBefore(earliest)) {
        fromDate = earliest;
      }
    } else {
      // Backward-compatible "last N days" mode. Negative days still fail in datesUntil (400).
      toDate = today;
      fromDate = today.minusDays(Math.min(days, MAX_DAYS) - 1L);
    }

    List<TokenUsage> rows =
        tokenUsageRepository.findUsageInRange(userId, fromDate.format(fmt), toDate.format(fmt));

    Map<String, TokenUsage> byDate =
        rows.stream().collect(Collectors.toMap(TokenUsage::getDate, u -> u));

    return fromDate
        .datesUntil(toDate.plusDays(1))
        .map(
            d -> {
              String date = d.format(fmt);
              TokenUsage u = byDate.get(date);
              int input = u == null ? 0 : u.getInputTokens();
              int output = u == null ? 0 : u.getOutputTokens();
              int count = u == null ? 0 : u.getRequestCount();
              return new TokenUsageDayResponse(date, input, output, count, input + output);
            })
        .collect(Collectors.toList());
  }

  private static LocalDate parseDate(String name, String value, DateTimeFormatter fmt) {
    try {
      return LocalDate.parse(value, fmt);
    } catch (DateTimeParseException e) {
      throw new BadRequestException(
          ErrorCodes.INVALID_PARAMETER, "'" + name + "' must be an ISO-8601 date (yyyy-MM-dd)");
    }
  }

  private String currentUserId() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication instanceof UserPrincipal principal) {
      return principal.getUserId();
    }
    throw new UnauthorizedException("User is not authenticated");
  }
}
