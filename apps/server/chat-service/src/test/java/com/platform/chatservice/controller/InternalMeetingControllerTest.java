package com.platform.chatservice.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.platform.chatservice.config.SecurityConfig;
import com.platform.chatservice.dto.meeting.MeetingListItem;
import com.platform.chatservice.dto.meeting.MeetingRecordView;
import com.platform.chatservice.security.InternalKeyGuard;
import com.platform.chatservice.security.JwtAuthenticationFilter;
import com.platform.chatservice.security.JwtUtil;
import com.platform.chatservice.security.SessionStatus;
import com.platform.chatservice.security.SessionValidator;
import com.platform.chatservice.service.meeting.MeetingDirectory;
import com.platform.chatservice.service.meeting.MeetingRecordReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = InternalMeetingController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, InternalKeyGuard.class})
@TestPropertySource(
    properties = {
      "app.cors.allowed-origins=https://app.example.com",
      "app.jwt.secret=test-secret-test-secret-test-secret-0123456789"
    })
class InternalMeetingControllerTest {

  private static final String KEY = "internal-key-123";
  private static final String URL = "/internal/meetings/m1/record";

  @Autowired private MockMvc mvc;
  @Autowired private InternalKeyGuard guard;

  @MockBean private MeetingRecordReader reader;
  @MockBean private MeetingDirectory directory;
  @MockBean private JwtUtil jwtUtil;
  @MockBean private SessionValidator sessionValidator;

  @BeforeEach
  void setUp() {
    ReflectionTestUtils.setField(guard, "internalKey", KEY);
  }

  private static MeetingRecordView view() {
    return new MeetingRecordView(
        new MeetingRecordView.Meeting("m1", "Sync", "abc", Instant.EPOCH, null, "Host"),
        List.of(new MeetingRecordView.Attendee("Lan")),
        List.of(new MeetingRecordView.Rec("SPEECH", "Lan", "hi", Instant.EPOCH, null)),
        List.of(new MeetingRecordView.Chat("Lan", "yo", Instant.EPOCH, null)),
        "note",
        null);
  }

  @Test
  void rejectsMissingKey() throws Exception {
    mvc.perform(get(URL).param("userId", "u1")).andExpect(status().isUnauthorized());
    verifyNoInteractions(reader);
  }

  @Test
  void validUserJwtWithoutInternalKeyIsStill401() throws Exception {
    when(jwtUtil.isValid("good-jwt")).thenReturn(true);
    when(jwtUtil.extractUserId("good-jwt")).thenReturn("u1");
    when(jwtUtil.extractPerms("good-jwt")).thenReturn(List.of());
    when(jwtUtil.extractDepts("good-jwt")).thenReturn(List.of());
    when(sessionValidator.validateToken(any(), any(), any())).thenReturn(SessionStatus.VALID);
    mvc.perform(get(URL).param("userId", "u1").header("Authorization", "Bearer good-jwt"))
        .andExpect(status().isUnauthorized());
    verifyNoInteractions(reader);
  }

  @Test
  void rejectsWrongKey() throws Exception {
    mvc.perform(get(URL).param("userId", "u1").header("X-Internal-Key", "nope"))
        .andExpect(status().isUnauthorized());
    verifyNoInteractions(reader);
  }

  @Test
  void rejectsWhenServerKeyBlank() throws Exception {
    ReflectionTestUtils.setField(guard, "internalKey", "");
    mvc.perform(get(URL).param("userId", "u1").header("X-Internal-Key", ""))
        .andExpect(status().isUnauthorized());
    verifyNoInteractions(reader);
  }

  @Test
  void validKeyReturnsTheView() throws Exception {
    when(reader.read("m1", "u1")).thenReturn(Optional.of(view()));
    mvc.perform(get(URL).param("userId", "u1").header("X-Internal-Key", KEY))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meeting.title").value("Sync"))
        .andExpect(jsonPath("$.attendees[0].displayName").value("Lan"))
        .andExpect(jsonPath("$.records[0].kind").value("SPEECH"))
        .andExpect(jsonPath("$.chat[0].senderName").value("Lan"))
        .andExpect(jsonPath("$.sharedNote").value("note"));
  }

  @Test
  void outsiderAndUnknownMeetingGetTheSame404Body() throws Exception {
    when(reader.read("m1", "outsider")).thenReturn(Optional.empty());
    when(reader.read("ghost", "u1")).thenReturn(Optional.empty());
    MvcResult a =
        mvc.perform(get(URL).param("userId", "outsider").header("X-Internal-Key", KEY))
            .andExpect(status().isNotFound())
            .andReturn();
    MvcResult b =
        mvc.perform(
                get("/internal/meetings/ghost/record")
                    .param("userId", "u1")
                    .header("X-Internal-Key", KEY))
            .andExpect(status().isNotFound())
            .andReturn();
    org.assertj.core.api.Assertions.assertThat(a.getResponse().getContentAsString())
        .isEqualTo(b.getResponse().getContentAsString())
        .isNotEmpty();
  }

  /**
   * Shared contract with ai-service ({@code contracts/meeting-record.internal.json}): the record as
   * this app's Jackson config writes it. {@code non_null} OMITS null fields (sharedNote, a system
   * SCREEN line's displayName, fileName, attachmentName) — and a null VALUE inside the stored
   * summary map too (an unassigned action item has no {@code assigneeName} key at all).
   */
  @Test
  void recordMatchesTheSharedContractFixture() throws Exception {
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("overview", "The team agreed to ship in December.");
    summary.put("keyPoints", List.of("Budget is 120k"));
    summary.put("decisions", List.of("Ship in December"));
    Map<String, Object> unassigned = new LinkedHashMap<>();
    unassigned.put("text", "Book the launch room");
    unassigned.put("assigneeName", null);
    summary.put(
        "actionItems",
        List.of(Map.of("text", "Prepare the release notes", "assigneeName", "Binh"), unassigned));
    summary.put("fromMaterials", List.of("Budget: 120k"));
    summary.put("language", "en");
    MeetingRecordView view =
        new MeetingRecordView(
            new MeetingRecordView.Meeting(
                "m1",
                "Q3 planning",
                "abc-defg-hij",
                Instant.parse("2026-11-06T01:00:00Z"),
                Instant.parse("2026-11-06T02:00:00Z"),
                "Lan"),
            List.of(new MeetingRecordView.Attendee("Lan"), new MeetingRecordView.Attendee("Binh")),
            List.of(
                new MeetingRecordView.Rec(
                    "SPEECH",
                    "Lan",
                    "Let us ship in December.",
                    Instant.parse("2026-11-06T01:05:00Z"),
                    null),
                new MeetingRecordView.Rec(
                    "FILE",
                    "Binh",
                    "Budget: 120k",
                    Instant.parse("2026-11-06T01:10:00Z"),
                    "budget.xlsx"),
                new MeetingRecordView.Rec(
                    "SCREEN", "Lan", "Slide: Q3 plan", Instant.parse("2026-11-06T01:15:00Z"), null),
                new MeetingRecordView.Rec(
                    "SCREEN",
                    null,
                    "Screen reading limit reached for this meeting.",
                    Instant.parse("2026-11-06T01:20:00Z"),
                    null)),
            List.of(
                new MeetingRecordView.Chat(
                    "Binh", "see the budget", Instant.parse("2026-11-06T01:09:00Z"), "budget.xlsx"),
                new MeetingRecordView.Chat(
                    "Lan", "@AI what did we decide?", Instant.parse("2026-11-06T01:30:00Z"), null)),
            null,
            summary);
    when(reader.read("m1", "u1")).thenReturn(Optional.of(view));
    String fixture = Files.readString(Path.of("..", "contracts", "meeting-record.internal.json"));

    mvc.perform(get(URL).param("userId", "u1").header("X-Internal-Key", KEY))
        .andExpect(status().isOk())
        .andExpect(content().json(fixture, true));
  }

  @Test
  void missingUserIdIs404NotAnError() throws Exception {
    when(reader.read("m1", null)).thenReturn(Optional.empty());
    mvc.perform(get(URL).header("X-Internal-Key", KEY))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith("application/json"));
  }

  @Test
  void listRequiresKey() throws Exception {
    mvc.perform(get("/internal/meetings").param("userId", "u1"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("Unauthorized"))
        .andExpect(jsonPath("$.statusCode").value(401));
    verifyNoInteractions(directory);
  }

  @Test
  void listBlankUserIdReturnsEmpty() throws Exception {
    mvc.perform(get("/internal/meetings").param("userId", " ").header("X-Internal-Key", KEY))
        .andExpect(status().isOk())
        .andExpect(content().json("[]"));
    mvc.perform(get("/internal/meetings").header("X-Internal-Key", KEY))
        .andExpect(status().isOk())
        .andExpect(content().json("[]"));
    verifyNoInteractions(directory);
  }

  @Test
  void listReturnsItemsAndClampsLimit() throws Exception {
    when(directory.listReadable("u1", "syn", 50))
        .thenReturn(
            List.of(
                new MeetingListItem("m1", "Sync", "abc", Instant.EPOCH, Instant.EPOCH, "DONE")));
    mvc.perform(
            get("/internal/meetings")
                .param("userId", "u1")
                .param("q", "syn")
                .param("limit", "999")
                .header("X-Internal-Key", KEY))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value("m1"))
        .andExpect(jsonPath("$[0].summaryState").value("DONE"));
    when(directory.listReadable("u1", null, 20)).thenReturn(List.of());
    mvc.perform(get("/internal/meetings").param("userId", "u1").header("X-Internal-Key", KEY))
        .andExpect(status().isOk());
    when(directory.listReadable("u1", null, 1)).thenReturn(List.of());
    mvc.perform(
            get("/internal/meetings")
                .param("userId", "u1")
                .param("limit", "-5")
                .header("X-Internal-Key", KEY))
        .andExpect(status().isOk());
  }
}
