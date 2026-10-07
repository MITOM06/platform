package com.platform.chatservice.controller;

import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.meeting.CreateMeetingRequest;
import com.platform.chatservice.dto.meeting.MeetingJoinResponse;
import com.platform.chatservice.dto.meeting.MeetingResponse;
import com.platform.chatservice.dto.meeting.UpdateMeetingRequest;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.meeting.MeetingJoinService;
import com.platform.chatservice.service.meeting.MeetingService;
import java.security.Principal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Meetings REST API (contract: {@code docs/api-spec.md} § Meetings). Thin: parses the request and
 * delegates — roles, capabilities and validation are checked in the services, and every refusal is
 * an {@code ApiException} with a stable code.
 */
@RestController
@RequestMapping("/api/meetings")
@RequiredArgsConstructor
public class MeetingController {

  private final MeetingService meetings;
  private final MeetingJoinService joins;

  @PostMapping
  public ResponseEntity<MeetingResponse> create(
      @RequestBody CreateMeetingRequest body, Principal principal) {
    return ResponseEntity.status(HttpStatus.CREATED).body(meetings.create(caller(principal), body));
  }

  @GetMapping
  public PageResponse<MeetingResponse> list(
      @RequestParam(required = false) String scope,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int size,
      Principal principal) {
    return meetings.list(caller(principal), scope, cursor, size);
  }

  @GetMapping("/{id}")
  public MeetingResponse get(@PathVariable String id, Principal principal) {
    return meetings.get(caller(principal), id);
  }

  @GetMapping("/by-code/{code}")
  public MeetingResponse getByCode(@PathVariable String code, Principal principal) {
    return meetings.getByCode(caller(principal), code);
  }

  @PatchMapping("/{id}")
  public MeetingResponse update(
      @PathVariable String id, @RequestBody UpdateMeetingRequest body, Principal principal) {
    return meetings.update(caller(principal), id, body);
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> cancel(@PathVariable String id, Principal principal) {
    meetings.cancel(caller(principal), id);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{id}/join")
  public MeetingJoinResponse join(@PathVariable String id, Principal principal) {
    return joins.join(caller(principal), id);
  }

  @DeleteMapping("/{id}/lobby")
  public ResponseEntity<Void> leaveLobby(@PathVariable String id, Principal principal) {
    joins.leaveLobby(principal.getName(), id);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{id}/lobby/{userId}/admit")
  public ResponseEntity<Void> admit(
      @PathVariable String id, @PathVariable String userId, Principal principal) {
    joins.admit(principal.getName(), id, userId);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{id}/lobby/{userId}/deny")
  public ResponseEntity<Void> deny(
      @PathVariable String id, @PathVariable String userId, Principal principal) {
    joins.deny(principal.getName(), id, userId);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{id}/end")
  public ResponseEntity<Void> end(@PathVariable String id, Principal principal) {
    joins.end(principal.getName(), id);
    return ResponseEntity.noContent().build();
  }

  /**
   * In production the principal is always the {@link UserPrincipal} set by {@code
   * JwtAuthenticationFilter}; the fallback (tests / legacy) carries no capabilities, so it cannot
   * create meetings.
   */
  private static UserPrincipal caller(Principal p) {
    return p instanceof UserPrincipal u ? u : new UserPrincipal(p.getName());
  }
}
