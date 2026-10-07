package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.platform.chatservice.config.LiveKitProperties;
import com.platform.chatservice.dto.meeting.CreateMeetingRequest;
import com.platform.chatservice.dto.meeting.HandDto;
import com.platform.chatservice.dto.meeting.MeetingHandsResponse;
import com.platform.chatservice.dto.meeting.MeetingJoinResponse;
import com.platform.chatservice.dto.meeting.MeetingNoteDto;
import com.platform.chatservice.dto.meeting.MeetingNoteRequest;
import com.platform.chatservice.dto.meeting.MeetingResponse;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.GlobalExceptionHandler;
import com.platform.chatservice.exception.MeetingNoteConflictException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.SfuCallService;
import com.platform.chatservice.service.meeting.MeetingChatService;
import com.platform.chatservice.service.meeting.MeetingHandService;
import com.platform.chatservice.service.meeting.MeetingJoinService;
import com.platform.chatservice.service.meeting.MeetingNotesService;
import com.platform.chatservice.service.meeting.MeetingNotesService.Scope;
import com.platform.chatservice.service.meeting.MeetingService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingControllerTest {

  @Mock private MeetingService meetings;
  @Mock private MeetingJoinService joins;
  @Mock private MeetingChatService chat;
  @Mock private MeetingNotesService notes;
  @Mock private MeetingHandService hands;
  private MockMvc mvc;
  private final UserPrincipal lan =
      new UserPrincipal("lan", "Member", List.of("HOST_MEETING"), List.of("dept-a"));

  @BeforeEach
  void setUp() {
    mvc =
        MockMvcBuilders.standaloneSetup(new MeetingController(meetings, joins, chat, notes, hands))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  private static MeetingResponse response(String id) {
    return new MeetingResponse(
        id,
        "abc-defg-hjk",
        "Sync",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        "SCHEDULED",
        null,
        null,
        null,
        "host",
        null,
        null,
        null,
        null);
  }

  @Test
  void createAnswers201AndHandsTheServiceTheCallersClaims() throws Exception {
    when(meetings.create(any(), any())).thenReturn(response("m1"));

    mvc.perform(
            post("/api/meetings")
                .principal(lan)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"title\":\"Sync\",\"inviteeIds\":[\"64b000000000000000000011\"],"
                        + "\"scheduledStart\":\"2026-10-08T02:00:00Z\","
                        + "\"settings\":{\"waitingRoom\":false}}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value("m1"))
        .andExpect(jsonPath("$.viewerRole").value("host"));

    ArgumentCaptor<UserPrincipal> who = ArgumentCaptor.forClass(UserPrincipal.class);
    ArgumentCaptor<CreateMeetingRequest> body = ArgumentCaptor.forClass(CreateMeetingRequest.class);
    verify(meetings).create(who.capture(), body.capture());
    assertThat(who.getValue().hasPermission("HOST_MEETING")).isTrue();
    assertThat(who.getValue().getDepts()).containsExactly("dept-a");
    assertThat(body.getValue().inviteeIds()).containsExactly("64b000000000000000000011");
    assertThat(body.getValue().settings().waitingRoom()).isFalse();
    assertThat(body.getValue().settings().locked()).isNull();
  }

  @Test
  void byCodeAndByIdAreDifferentRoutes() throws Exception {
    when(meetings.getByCode(any(), eq("abc-defg-hjk"))).thenReturn(response("m1"));
    when(meetings.get(any(), eq("m2"))).thenReturn(response("m2"));

    mvc.perform(get("/api/meetings/by-code/abc-defg-hjk").principal(lan))
        .andExpect(jsonPath("$.id").value("m1"));
    mvc.perform(get("/api/meetings/m2").principal(lan)).andExpect(jsonPath("$.id").value("m2"));
  }

  @Test
  void listPassesScopeCursorAndSize() throws Exception {
    when(meetings.list(any(), eq("past"), eq("m9"), eq(5)))
        .thenReturn(new com.platform.chatservice.dto.PageResponse<>(List.of(), 0, 5, 0));
    mvc.perform(get("/api/meetings?scope=past&cursor=m9&size=5").principal(lan))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.hasNext").value(false));
  }

  @Test
  void joinedAndWaitingBodies() throws Exception {
    when(joins.join(any(), eq("m1")))
        .thenReturn(MeetingJoinResponse.joined("wss://rtc.example.com", "jwt", "attendee"));
    mvc.perform(post("/api/meetings/m1/join").principal(lan))
        .andExpect(jsonPath("$.status").value("joined"))
        .andExpect(jsonPath("$.url").value("wss://rtc.example.com"))
        .andExpect(jsonPath("$.token").value("jwt"))
        .andExpect(jsonPath("$.role").value("attendee"));

    when(joins.join(any(), eq("m2"))).thenReturn(MeetingJoinResponse.waiting());
    mvc.perform(post("/api/meetings/m2/join").principal(lan))
        .andExpect(jsonPath("$.status").value("waiting"))
        .andExpect(jsonPath("$.token").doesNotExist())
        .andExpect(jsonPath("$.url").doesNotExist());
  }

  @Test
  void lobbyAndEndRoutesAnswer204() throws Exception {
    mvc.perform(delete("/api/meetings/m1/lobby").principal(lan)).andExpect(status().isNoContent());
    mvc.perform(post("/api/meetings/m1/lobby/u9/admit").principal(lan))
        .andExpect(status().isNoContent());
    mvc.perform(post("/api/meetings/m1/lobby/u9/deny").principal(lan))
        .andExpect(status().isNoContent());
    mvc.perform(post("/api/meetings/m1/end").principal(lan)).andExpect(status().isNoContent());
    mvc.perform(delete("/api/meetings/m1").principal(lan)).andExpect(status().isNoContent());

    verify(joins).leaveLobby("lan", "m1");
    verify(joins).admit("lan", "m1", "u9");
    verify(joins).deny("lan", "m1", "u9");
    verify(joins).end("lan", "m1");
  }

  @Test
  void errorsCarryACodeAndParamsButNoInternalMessage() throws Exception {
    when(meetings.create(any(), any()))
        .thenThrow(
            new ApiException(
                HttpStatus.BAD_REQUEST,
                "MEETING_INVALID",
                null,
                Map.of("field", "title", "max", 120)));
    mvc.perform(
            post("/api/meetings")
                .principal(lan)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"x\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("MEETING_INVALID"))
        .andExpect(jsonPath("$.params.field").value("title"))
        .andExpect(jsonPath("$.params.max").value(120))
        .andExpect(jsonPath("$.message").doesNotExist());

    when(joins.join(any(), eq("m1")))
        .thenThrow(new ApiException(HttpStatus.FORBIDDEN, "MEETING_REMOVED"));
    mvc.perform(post("/api/meetings/m1/join").principal(lan))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("MEETING_REMOVED"))
        .andExpect(jsonPath("$.statusCode").value(403));
  }

  @Test
  void aDateTimeWithoutAnOffsetIsAnInvalidFieldNotAServerError() throws Exception {
    // What Dart's DateTime.toIso8601String() sends for a local time without .toUtc().
    mvc.perform(
            post("/api/meetings")
                .principal(lan)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"scheduledStart\":\"2026-10-08T09:00:00.000\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("MEETING_INVALID"))
        .andExpect(jsonPath("$.params.field").value("scheduledStart"))
        .andExpect(jsonPath("$.message").doesNotExist());
    mvc.perform(
            patch("/api/meetings/m1")
                .principal(lan)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{not json"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("MEETING_INVALID"))
        .andExpect(jsonPath("$.message").doesNotExist());
    verifyNoInteractions(meetings);
  }

  @Test
  void aNonNumericPageSizeIsAnInvalidField() throws Exception {
    mvc.perform(get("/api/meetings?size=abc").principal(lan))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("MEETING_INVALID"))
        .andExpect(jsonPath("$.params.field").value("size"))
        .andExpect(jsonPath("$.message").doesNotExist());
  }

  @Test
  void anInstantMeetingNeedsNoBody() throws Exception {
    when(meetings.create(any(), any())).thenReturn(response("m1"));

    mvc.perform(post("/api/meetings").principal(lan))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value("m1"));
    verify(meetings).create(any(), isNull());
  }

  @Test
  void meetingRoutesDoNotCollideWithCallRoutes() {
    assertThatCode(
            () ->
                MockMvcBuilders.standaloneSetup(
                        new MeetingController(meetings, joins, chat, notes, hands),
                        new CallRestController(
                            org.mockito.Mockito.mock(SfuCallService.class),
                            new LiveKitProperties()))
                    .build())
        .doesNotThrowAnyException();
  }

  @Test
  void messagesPassTheCursorAndDefaultToFiftyPerPage() throws Exception {
    when(chat.history(any(), eq("m1"), eq("x9"), eq(10)))
        .thenReturn(new com.platform.chatservice.dto.PageResponse<>(List.of(), 0, 10, 0));
    mvc.perform(get("/api/meetings/m1/messages?before=x9&size=10").principal(lan))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.hasNext").value(false));

    mvc.perform(get("/api/meetings/m1/messages").principal(lan));
    verify(chat).history(any(), eq("m1"), isNull(), eq(50));
  }

  @Test
  void aNonNumericPageSizeIsMeetingInvalidNotA500() throws Exception {
    mvc.perform(get("/api/meetings/m1/messages?size=abc").principal(lan))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("MEETING_INVALID"))
        .andExpect(jsonPath("$.params.field").value("size"));
  }

  @Test
  void theNoteScopeComesFromThePath() throws Exception {
    when(notes.get(any(), eq("m1"), eq(Scope.SHARED)))
        .thenReturn(new MeetingNoteDto("shared", "", 0, null, null));
    mvc.perform(get("/api/meetings/m1/notes/shared").principal(lan))
        .andExpect(jsonPath("$.scope").value("shared"))
        .andExpect(jsonPath("$.version").value(0))
        .andExpect(jsonPath("$.updatedBy").doesNotExist());

    mvc.perform(
            put("/api/meetings/m1/notes/private")
                .principal(lan)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"x\",\"version\":3}"))
        .andExpect(status().isOk());
    verify(notes).put(any(), eq("m1"), eq(Scope.PRIVATE), eq(new MeetingNoteRequest("x", 3L)));
  }

  @Test
  void aNoteConflictAnswers409WithTheLatestNote() throws Exception {
    MeetingNoteDto latest =
        new MeetingNoteDto(
            "shared",
            "B",
            8,
            new PersonDto("u2", "Hoa", null),
            Instant.parse("2026-10-08T02:31:02Z"));
    when(notes.put(any(), eq("m1"), eq(Scope.SHARED), any()))
        .thenThrow(new MeetingNoteConflictException(latest));

    mvc.perform(
            put("/api/meetings/m1/notes/shared")
                .principal(lan)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"C\",\"version\":7}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("MEETING_NOTE_CONFLICT"))
        .andExpect(jsonPath("$.statusCode").value(409))
        .andExpect(jsonPath("$.latest.content").value("B"))
        .andExpect(jsonPath("$.latest.version").value(8))
        .andExpect(jsonPath("$.latest.updatedBy.displayName").value("Hoa"))
        .andExpect(jsonPath("$.message").doesNotExist());
  }

  @Test
  void theHandsSnapshotIsServed() throws Exception {
    when(hands.snapshot(any(), eq("m1")))
        .thenReturn(
            new MeetingHandsResponse(
                List.of(new HandDto("u3", "Hoa", Instant.parse("2026-10-08T02:06:00Z")))));
    mvc.perform(get("/api/meetings/m1/hands").principal(lan))
        .andExpect(jsonPath("$.hands[0].userId").value("u3"))
        .andExpect(jsonPath("$.hands[0].displayName").value("Hoa"));
  }
}
