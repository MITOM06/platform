package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * {@code POST /api/meetings/{id}/join}: {@code joined} with a LiveKit url + token + room role, or
 * {@code waiting} (in the lobby until {@code meet.admitted}).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MeetingJoinResponse(String status, String url, String token, String role) {

  public static MeetingJoinResponse joined(String url, String token, String role) {
    return new MeetingJoinResponse("joined", url, token, role);
  }

  public static MeetingJoinResponse waiting() {
    return new MeetingJoinResponse("waiting", null, null, null);
  }
}
