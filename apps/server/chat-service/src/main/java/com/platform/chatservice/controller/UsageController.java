package com.platform.chatservice.controller;

import com.platform.chatservice.dto.TokenUsageDayResponse;
import com.platform.chatservice.exception.UnauthorizedException;
import com.platform.chatservice.model.TokenUsage;
import com.platform.chatservice.repository.TokenUsageRepository;
import com.platform.chatservice.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/usage")
@RequiredArgsConstructor
public class UsageController {

    private final TokenUsageRepository tokenUsageRepository;

    @GetMapping("/tokens")
    public List<TokenUsageDayResponse> getTokenUsage(
            @RequestParam(defaultValue = "30") int days) {
        final String userId = currentUserId();
        final DateTimeFormatter fmt = DateTimeFormatter.ISO_LOCAL_DATE;
        final LocalDate toDate = LocalDate.now();
        final LocalDate fromDate = toDate.minusDays(days - 1L);

        List<TokenUsage> rows = tokenUsageRepository.findByUserIdAndDateBetweenOrderByDateAsc(
            userId, fromDate.format(fmt), toDate.format(fmt));

        Map<String, TokenUsage> byDate = rows.stream()
            .collect(Collectors.toMap(TokenUsage::getDate, u -> u));

        return fromDate.datesUntil(toDate.plusDays(1))
            .map(d -> {
                String date = d.format(fmt);
                TokenUsage u = byDate.get(date);
                int input = u == null ? 0 : u.getInputTokens();
                int output = u == null ? 0 : u.getOutputTokens();
                int count = u == null ? 0 : u.getRequestCount();
                return new TokenUsageDayResponse(date, input, output, count, input + output);
            })
            .collect(Collectors.toList());
    }

    private String currentUserId() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof UserPrincipal principal) {
            return principal.getUserId();
        }
        throw new UnauthorizedException("User is not authenticated");
    }
}
