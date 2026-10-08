package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.MeetingChatCommand;
import com.platform.chatservice.dto.meeting.MeetingHandCommand;
import com.platform.chatservice.dto.meeting.MeetingHostCommand;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.RateLimitExceededException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.meeting.MeetingChatService;
import com.platform.chatservice.service.meeting.MeetingEvents;
import com.platform.chatservice.service.meeting.MeetingHandService;
import com.platform.chatservice.service.meeting.MeetingHostService;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingWsControllerTest {

  @Mock private MeetingHandService hands;
  @Mock private MeetingChatService chat;
  @Mock private MeetingHostService host;
  @Mock private MeetingEvents events;
  private MeetingWsController controller;
  private final UserPrincipal an = new UserPrincipal("a", "Member", List.of(), List.of("dept-a"));

  @BeforeEach
  void setUp() {
    controller = new MeetingWsController(hands, chat, host, events);
  }

  @Test
  void raisingPassesTheCallersClaimsAndAMissingFlagMeansLower() {
    controller.hand(new MeetingHandCommand("m1", true), an);
    controller.hand(new MeetingHandCommand("m1", null), an);

    verify(hands).setHand(an, "m1", true);
    verify(hands).setHand(an, "m1", false);
  }

  @Test
  void aRefusedChatIsReportedToTheSenderAloneWithItsClientId() {
    doThrow(
            new ApiException(
                HttpStatus.BAD_REQUEST,
                "MEETING_INVALID",
                null,
                Map.of("field", "content", "max", 2000)))
        .when(chat)
        .send(any(), eq("m1"), anyString(), eq("c-1"));

    controller.chat(new MeetingChatCommand("m1", "x", "c-1"), an);

    verify(events)
        .error("a", "m1", null, "c-1", "MEETING_INVALID", Map.of("field", "content", "max", 2000));
  }

  @Test
  void aJunkClientIdIsNeverEchoedBack() {
    doThrow(new ApiException(HttpStatus.FORBIDDEN, "MEETING_FORBIDDEN"))
        .when(chat)
        .send(any(), any(), any(), any());

    controller.chat(new MeetingChatCommand("m1", "x", "<script>"), an);

    verify(events).error(eq("a"), eq("m1"), isNull(), isNull(), eq("MEETING_FORBIDDEN"), isNull());
  }

  @Test
  void aRateLimitedChatIsReportedAsRateLimited() {
    doThrow(new RateLimitExceededException()).when(chat).send(any(), any(), any(), any());

    controller.chat(new MeetingChatCommand("m1", "x", null), an);

    verify(events).error("a", "m1", null, null, "RATE_LIMITED", null);
  }

  @Test
  void aFailedHostCommandEchoesItsAction() {
    doThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "MEETINGS_UNAVAILABLE"))
        .when(host)
        .execute(any(), any());

    controller.host(new MeetingHostCommand("m1", "MUTE_ALL", null), an);

    verify(events).error("a", "m1", "MUTE_ALL", null, "MEETINGS_UNAVAILABLE", null);
  }

  @Test
  void anUnknownHostActionIsNeverEchoedBack() {
    doThrow(
            new ApiException(
                HttpStatus.BAD_REQUEST, "MEETING_INVALID", null, Map.of("field", "action")))
        .when(host)
        .execute(any(), any());

    controller.host(new MeetingHostCommand("m1", "<img src=x>".repeat(100), null), an);
    controller.host(new MeetingHostCommand("m1", "mute_all", null), an); // exact names only

    verify(events, times(2))
        .error(
            eq("a"),
            eq("m1"),
            isNull(),
            isNull(),
            eq("MEETING_INVALID"),
            eq(Map.of("field", "action")));
  }

  @Test
  void aLegacyPrincipalStillActsAsItsUser() {
    Principal legacy = mock(Principal.class);
    when(legacy.getName()).thenReturn("a");

    controller.host(new MeetingHostCommand("m1", "LOCK", null), legacy);

    verify(host).execute(argThat(u -> "a".equals(u.getUserId())), any());
  }

  @Test
  void unexpectedFailuresAreNotDisguisedAsAnApiError() {
    doThrow(new IllegalStateException("bug")).when(hands).setHand(any(), any(), eq(true));

    assertThatThrownBy(() -> controller.hand(new MeetingHandCommand("m1", true), an))
        .isInstanceOf(IllegalStateException.class);
    verify(events, never()).error(any(), any(), any(), any(), any(), any());
  }
}
