package com.platform.chatservice.service.meeting;

import com.platform.chatservice.dto.meeting.MeetingSummaryResponse;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.model.MeetingSummaryDoc;
import com.platform.chatservice.model.MeetingSummaryState;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Reads and regenerates the AI summary of a meeting (REST). */
@Service
@RequiredArgsConstructor
public class MeetingSummaryService {

  private final MeetingGuard guard;
  private final MeetingSummaryStore summaries;
  private final MeetingSummaryTrigger trigger;
  private final ConversationRepository conversations;

  public MeetingSummaryResponse get(UserPrincipal caller, String meetingId) {
    Meeting m = guard.records(caller, meetingId);
    String state = m.getSummaryState() == null ? null : m.getSummaryState().name();
    MeetingSummaryDoc doc = summaries.latest(m.getId()).orElse(null);
    boolean inGroup = inGroup(m, caller.getUserId());
    return new MeetingSummaryResponse(
        state,
        doc == null ? null : doc.getSummary(),
        doc == null ? null : doc.getCreatedAt(),
        inGroup ? m.getGroupConversationId() : null,
        inGroup);
  }

  /** Host / co-host only; asks ai-service again. Answers {@code PENDING} (HTTP 202). */
  public MeetingSummaryResponse regenerate(UserPrincipal caller, String meetingId) {
    Meeting m = guard.records(caller, meetingId);
    if (!MeetingAccess.canManage(m, caller.getUserId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.MEETING_FORBIDDEN);
    }
    if (m.getStatus() != MeetingStatus.ENDED || !m.isAiNotesEverEnabled()) {
      throw conflict(ErrorCodes.MEETING_SUMMARY_UNAVAILABLE);
    }
    if (m.getSummaryState() == MeetingSummaryState.PENDING) {
      throw conflict(ErrorCodes.MEETING_SUMMARY_PENDING);
    }
    if (trigger.regenerate(m) == MeetingSummaryTrigger.Result.REFUSED) {
      throw conflict(ErrorCodes.MEETING_SUMMARY_PENDING); // lost the claim to a concurrent request
    }
    // PUBLISH_FAILED: still PENDING for us; the stale sweep turns it into FAILED.
    return new MeetingSummaryResponse(MeetingSummaryState.PENDING.name(), null, null, null, false);
  }

  private boolean inGroup(Meeting m, String userId) {
    String gid = m.getGroupConversationId();
    if (gid == null || userId == null) {
      return false;
    }
    return conversations
        .findById(gid)
        .map(c -> c.getParticipants() != null && c.getParticipants().contains(userId))
        .orElse(false);
  }

  private static ApiException conflict(String code) {
    return new ApiException(HttpStatus.CONFLICT, code);
  }
}
