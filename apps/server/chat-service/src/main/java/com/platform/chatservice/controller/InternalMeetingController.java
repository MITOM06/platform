package com.platform.chatservice.controller;

import com.platform.chatservice.security.InternalKeyGuard;
import com.platform.chatservice.service.meeting.MeetingDirectory;
import com.platform.chatservice.service.meeting.MeetingRecordReader;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Service-to-service meeting reads for ai-service. No JWT: {@link InternalKeyGuard} is the only
 * gate. A bad key is 401; every other refusal is one identical 404 (never 403).
 */
@RestController
@RequestMapping("/internal/meetings")
@RequiredArgsConstructor
public class InternalMeetingController {

  private static final int DEFAULT_LIMIT = 20;
  private static final int MAX_LIMIT = 50;
  private static final Map<String, Object> UNAUTHORIZED =
      Map.of("error", "Unauthorized", "statusCode", 401);
  private static final Map<String, Object> NOT_FOUND =
      Map.of("error", "Not Found", "statusCode", 404);

  private final InternalKeyGuard keyGuard;
  private final MeetingRecordReader reader;
  private final MeetingDirectory directory;

  /** Meetings {@code userId} may read; blank or missing user is an empty list, never an error. */
  @GetMapping
  public ResponseEntity<?> list(
      @RequestParam(required = false) String userId,
      @RequestParam(required = false) String q,
      @RequestParam(required = false) Integer limit,
      HttpServletRequest req) {
    if (!keyGuard.check(req)) {
      return json(HttpStatus.UNAUTHORIZED, UNAUTHORIZED);
    }
    if (userId == null || userId.isBlank()) {
      return json(HttpStatus.OK, List.of());
    }
    int n = limit == null ? DEFAULT_LIMIT : Math.max(1, Math.min(limit, MAX_LIMIT));
    return json(HttpStatus.OK, directory.listReadable(userId, q, n));
  }

  @GetMapping("/{id}/record")
  public ResponseEntity<?> record(
      @PathVariable String id,
      @RequestParam(required = false) String userId,
      HttpServletRequest req) {
    if (!keyGuard.check(req)) {
      return json(HttpStatus.UNAUTHORIZED, UNAUTHORIZED);
    }
    return reader
        .read(id, userId)
        .<ResponseEntity<?>>map(view -> json(HttpStatus.OK, view))
        .orElseGet(() -> json(HttpStatus.NOT_FOUND, NOT_FOUND));
  }

  private static ResponseEntity<Object> json(HttpStatus status, Object body) {
    return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(body);
  }
}
