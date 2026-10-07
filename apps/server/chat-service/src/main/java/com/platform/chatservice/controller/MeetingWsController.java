package com.platform.chatservice.controller;

import com.platform.chatservice.dto.meeting.MeetingChatCommand;
import com.platform.chatservice.dto.meeting.MeetingHandCommand;
import com.platform.chatservice.dto.meeting.MeetingHostCommand;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.exception.RateLimitExceededException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.meeting.MeetingChatService;
import com.platform.chatservice.service.meeting.MeetingEvents;
import com.platform.chatservice.service.meeting.MeetingHandService;
import com.platform.chatservice.service.meeting.MeetingHostAction;
import com.platform.chatservice.service.meeting.MeetingHostService;
import java.security.Principal;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

/**
 * In-meeting STOMP commands ({@code SEND /app/meet.*}). Thin: parses and delegates. A refused
 * command is answered to its sender alone as {@code meet.error} on {@code /user/queue/meeting} with
 * a stable {@code errorCode} — never the exception's text. Unexpected failures are not swallowed.
 */
@Controller
@RequiredArgsConstructor
public class MeetingWsController {

  private final MeetingHandService hands;
  private final MeetingChatService chat;
  private final MeetingHostService host;
  private final MeetingEvents events;

  /** Raise / lower the caller's own hand; a missing {@code raised} lowers. */
  @MessageMapping("/meet.hand")
  public void hand(@Payload MeetingHandCommand cmd, Principal principal) {
    reply(
        principal,
        cmd.meetingId(),
        null,
        null,
        () -> hands.setHand(caller(principal), cmd.meetingId(), Boolean.TRUE.equals(cmd.raised())));
  }

  @MessageMapping("/meet.chat")
  public void chat(@Payload MeetingChatCommand cmd, Principal principal) {
    reply(
        principal,
        cmd.meetingId(),
        null,
        MeetingChatService.clientIdOrNull(cmd.clientId()),
        () -> chat.send(caller(principal), cmd.meetingId(), cmd.content(), cmd.clientId()));
  }

  /** {@code meet.error.action} is the parsed action, or null — never the client's raw string. */
  @MessageMapping("/meet.host")
  public void host(@Payload MeetingHostCommand cmd, Principal principal) {
    String action = MeetingHostAction.parse(cmd.action()).map(Enum::name).orElse(null);
    reply(principal, cmd.meetingId(), action, null, () -> host.execute(caller(principal), cmd));
  }

  private void reply(
      Principal principal, String meetingId, String action, String clientId, Runnable command) {
    try {
      command.run();
    } catch (ApiException e) {
      events.error(principal.getName(), meetingId, action, clientId, e.getCode(), e.getParams());
    } catch (RateLimitExceededException e) {
      events.error(principal.getName(), meetingId, action, clientId, ErrorCodes.RATE_LIMITED, null);
    }
  }

  /** Same as {@code MeetingController}: the STOMP principal is a {@link UserPrincipal}. */
  private static UserPrincipal caller(Principal p) {
    return p instanceof UserPrincipal u ? u : new UserPrincipal(p.getName());
  }
}
