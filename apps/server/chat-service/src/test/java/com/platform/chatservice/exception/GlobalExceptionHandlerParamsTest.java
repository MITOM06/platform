package com.platform.chatservice.exception;

import static org.assertj.core.api.Assertions.assertThat;

import com.platform.chatservice.dto.meeting.MeetingNoteDto;
import com.platform.chatservice.dto.meeting.PersonDto;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Coded errors keep {@code code} — and {@code params} when present — at the TOP level. */
class GlobalExceptionHandlerParamsTest {

  private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

  @Test
  void apiExceptionWithParams_putsCodeAndParamsTopLevel() {
    ResponseEntity<Map<String, Object>> response =
        handler.handleApi(
            new ApiException(
                HttpStatus.CONFLICT,
                ErrorCodes.PIN_LIMIT_REACHED,
                "At most 5 messages can be pinned",
                Map.of("max", 5)));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(response.getBody())
        .containsEntry("code", "PIN_LIMIT_REACHED")
        .containsEntry("params", Map.of("max", 5))
        .containsEntry("statusCode", 409);
  }

  @Test
  void apiExceptionWithoutParams_omitsTheField() {
    ResponseEntity<Map<String, Object>> response =
        handler.handleApi(
            new ApiException(
                HttpStatus.NOT_FOUND, ErrorCodes.NOT_A_MEMBER, "User is not a member"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    assertThat(response.getBody())
        .containsEntry("code", "NOT_A_MEMBER")
        .doesNotContainKey("params");
  }

  @Test
  void badRequestWithCode_keepsTheCodeTopLevel() {
    ResponseEntity<Map<String, Object>> response =
        handler.handleBadRequest(
            new BadRequestException(ErrorCodes.NOT_A_GROUP, "Not a group conversation"));

    assertThat(response.getBody())
        .containsEntry("code", "NOT_A_GROUP")
        .containsEntry("statusCode", 400);
  }

  @Test
  void unreadableInputOutsideMeetingsIsAGenericCodedBadRequest() {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/messages");
    MethodArgumentTypeMismatchException mismatch =
        new MethodArgumentTypeMismatchException("abc", Integer.class, "limit", null, null);

    ResponseEntity<Map<String, Object>> response = handler.handleUnreadable(mismatch, request);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(response.getBody())
        .containsEntry("code", "INVALID_PARAMETER")
        .containsEntry("params", Map.of("field", "limit"))
        .containsEntry("statusCode", 400)
        .doesNotContainKey("message");
  }

  @Test
  void unreadableBodyOnAMeetingRouteIsMeetingInvalid() {
    MockHttpServletRequest request = new MockHttpServletRequest("PATCH", "/api/meetings/m1");
    HttpMessageNotReadableException unreadable =
        new HttpMessageNotReadableException(
            "JSON parse error: at line 1", new MockHttpInputMessage(new byte[0]));

    ResponseEntity<Map<String, Object>> response = handler.handleUnreadable(unreadable, request);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(response.getBody())
        .containsEntry("code", "MEETING_INVALID")
        .doesNotContainKeys("message", "params");
  }

  @Test
  void aNoteConflictCarriesTheLatestNoteNextToTheCode() {
    MeetingNoteDto latest =
        new MeetingNoteDto(
            "shared",
            "B",
            2,
            new PersonDto("u2", "Hoa", null),
            Instant.parse("2026-10-08T02:31:02Z"));

    ResponseEntity<Map<String, Object>> r =
        new GlobalExceptionHandler().handleNoteConflict(new MeetingNoteConflictException(latest));

    assertThat(r.getStatusCode().value()).isEqualTo(409);
    assertThat(r.getBody())
        .containsEntry("code", "MEETING_NOTE_CONFLICT")
        .containsEntry("statusCode", 409)
        .containsEntry("latest", latest)
        .doesNotContainKey("message");
  }

  /** A 429 carries a stable code and the retry hint — never the exception's English text. */
  @Test
  void rateLimit_isACodeWithRetryAfterAndNoRawText() {
    ResponseEntity<Map<String, Object>> response =
        handler.handleRateLimit(new RateLimitExceededException());

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    assertThat(response.getHeaders().getFirst("Retry-After")).isEqualTo("5");
    assertThat(response.getBody())
        .containsEntry("code", "RATE_LIMITED")
        .containsEntry("statusCode", 429)
        .doesNotContainKey("message");
  }
}
