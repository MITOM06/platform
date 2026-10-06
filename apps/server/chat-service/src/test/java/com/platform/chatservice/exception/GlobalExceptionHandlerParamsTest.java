package com.platform.chatservice.exception;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

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
}
