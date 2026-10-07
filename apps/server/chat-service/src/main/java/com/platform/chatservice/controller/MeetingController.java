package com.platform.chatservice.controller;

import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.meeting.CreateMeetingRequest;
import com.platform.chatservice.dto.meeting.MeetingHandsResponse;
import com.platform.chatservice.dto.meeting.MeetingJoinResponse;
import com.platform.chatservice.dto.meeting.MeetingMessageDto;
import com.platform.chatservice.dto.meeting.MeetingNoteDto;
import com.platform.chatservice.dto.meeting.MeetingNoteRequest;
import com.platform.chatservice.dto.meeting.MeetingResponse;
import com.platform.chatservice.dto.meeting.UpdateMeetingRequest;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.meeting.MeetingChatService;
import com.platform.chatservice.service.meeting.MeetingHandService;
import com.platform.chatservice.service.meeting.MeetingJoinService;
import com.platform.chatservice.service.meeting.MeetingNotesService;
import com.platform.chatservice.service.meeting.MeetingNotesService.Scope;
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
import org.springframework.web.bind.annotation.PutMapping;
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
  private final MeetingChatService chat;
  private final MeetingNotesService notes;
  private final MeetingHandService hands;

  /** No body (or an empty one) creates an instant meeting with every default ("họp ngay"). */
  @PostMapping
  public ResponseEntity<MeetingResponse> create(
      @RequestBody(required = false) CreateMeetingRequest body, Principal principal) {
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

  /** In-meeting chat history, newest first; {@code before} = id of the oldest line already held. */
  @GetMapping("/{id}/messages")
  public PageResponse<MeetingMessageDto> messages(
      @PathVariable String id,
      @RequestParam(required = false) String before,
      @RequestParam(defaultValue = "50") int size,
      Principal principal) {
    return chat.history(caller(principal), id, before, size);
  }

  @GetMapping("/{id}/notes/shared")
  public MeetingNoteDto sharedNote(@PathVariable String id, Principal principal) {
    return notes.get(caller(principal), id, Scope.SHARED);
  }

  @PutMapping("/{id}/notes/shared")
  public MeetingNoteDto saveSharedNote(
      @PathVariable String id,
      @RequestBody(required = false) MeetingNoteRequest body,
      Principal principal) {
    return notes.put(caller(principal), id, Scope.SHARED, body);
  }

  /** Always the caller's own private note. */
  @GetMapping("/{id}/notes/private")
  public MeetingNoteDto privateNote(@PathVariable String id, Principal principal) {
    return notes.get(caller(principal), id, Scope.PRIVATE);
  }

  @PutMapping("/{id}/notes/private")
  public MeetingNoteDto savePrivateNote(
      @PathVariable String id,
      @RequestBody(required = false) MeetingNoteRequest body,
      Principal principal) {
    return notes.put(caller(principal), id, Scope.PRIVATE, body);
  }

  /** Raised hands in raise order — for a client that joins or reconnects mid-meeting. */
  @GetMapping("/{id}/hands")
  public MeetingHandsResponse hands(@PathVariable String id, Principal principal) {
    return hands.snapshot(caller(principal), id);
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
