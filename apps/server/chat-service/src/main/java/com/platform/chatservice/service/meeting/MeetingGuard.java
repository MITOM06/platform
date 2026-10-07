package com.platform.chatservice.service.meeting;

import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.meeting.MeetingAccess.Decision;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Finds a meeting and checks the caller may use it — shared by hands, chat and notes. Every refusal
 * is an {@link ApiException} with a stable {@link ErrorCodes} code.
 */
@Component
@RequiredArgsConstructor
public class MeetingGuard {

  private final MeetingStore store;
  private final MeetingLobby lobby;

  /** The meeting, or 404 {@code MEETING_NOT_FOUND} (a blank id never reaches the database). */
  public Meeting find(String meetingId) {
    if (meetingId == null || meetingId.isBlank()) {
      throw MeetingService.notFound();
    }
    return store.findById(meetingId).orElseThrow(MeetingService::notFound);
  }

  /**
   * For in-room actions (hands, chat, {@code GET /hands}): exactly the people who would get a
   * LiveKit token. Ended ⇒ 409 {@code MEETING_ENDED}; removed ⇒ 403 {@code MEETING_REMOVED};
   * waiting / locked out ⇒ 403 {@code MEETING_FORBIDDEN}.
   */
  public Meeting inRoom(UserPrincipal caller, String meetingId) {
    Meeting m = find(meetingId);
    String uid = caller.getUserId();
    Decision d = MeetingAccess.decide(m, uid, caller.getDepts(), admitted(meetingId, uid));
    if (d == Decision.DENIED_ENDED) {
      throw MeetingService.ended();
    }
    if (d == Decision.DENIED_REMOVED) {
      throw removed();
    }
    if (!d.entersRoom()) {
      throw forbidden();
    }
    return m;
  }

  /**
   * For the meeting's records (chat history, notes) — also after it ended. Removed ⇒ 403 {@code
   * MEETING_REMOVED}; never belonged ⇒ 403 {@code MEETING_FORBIDDEN}.
   */
  public Meeting records(UserPrincipal caller, String meetingId) {
    Meeting m = find(meetingId);
    String uid = caller.getUserId();
    if (uid != null && m.getRemovedIds() != null && m.getRemovedIds().contains(uid)) {
      throw removed();
    }
    if (!MeetingAccess.canReadRecords(m, uid, caller.getDepts(), admitted(meetingId, uid))) {
      throw forbidden();
    }
    return m;
  }

  /** Whether the host let this person in from the lobby (Redis). */
  public boolean admitted(String meetingId, String userId) {
    return userId != null && lobby.isAdmitted(meetingId, userId);
  }

  private static ApiException removed() {
    return new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.MEETING_REMOVED);
  }

  private static ApiException forbidden() {
    return new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.MEETING_FORBIDDEN);
  }
}
