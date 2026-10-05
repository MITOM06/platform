package com.platform.chatservice.exception;

import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

  @ExceptionHandler(ConversationNotFoundException.class)
  public ResponseEntity<Map<String, Object>> handleNotFound(ConversationNotFoundException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(Map.of("error", "Not found", "message", ex.getMessage(), "statusCode", 404));
  }

  @ExceptionHandler(MessageNotFoundException.class)
  public ResponseEntity<Map<String, Object>> handleMessageNotFound(MessageNotFoundException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(Map.of("error", "Not found", "message", ex.getMessage(), "statusCode", 404));
  }

  @ExceptionHandler(UnauthorizedException.class)
  public ResponseEntity<Map<String, Object>> handleUnauthorized(UnauthorizedException ex) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(Map.of("error", "Unauthorized", "message", ex.getMessage(), "statusCode", 401));
  }

  @ExceptionHandler(ForbiddenException.class)
  public ResponseEntity<Map<String, Object>> handleForbidden(ForbiddenException ex) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(body("Forbidden", ex.getMessage(), ex.getCode(), 403));
  }

  @ExceptionHandler(DuplicateConversationException.class)
  public ResponseEntity<Map<String, Object>> handleDuplicate(DuplicateConversationException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(
            Map.of(
                "error",
                "Conversation already exists",
                "conversationId",
                ex.getConversationId(),
                "statusCode",
                409));
  }

  @ExceptionHandler(BadRequestException.class)
  public ResponseEntity<Map<String, Object>> handleBadRequest(BadRequestException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(body("Bad request", ex.getMessage(), ex.getCode(), 400));
  }

  /** Errors with an explicit status + stable code (e.g. 502/503 from the assistant bridge). */
  @ExceptionHandler(ApiException.class)
  public ResponseEntity<Map<String, Object>> handleApi(ApiException ex) {
    if (ex.getStatus().is5xxServerError()) {
      log.warn("{} {}: {}", ex.getStatus().value(), ex.getCode(), ex.getMessage(), ex.getCause());
    }
    return ResponseEntity.status(ex.getStatus())
        .body(
            body(
                ex.getStatus().getReasonPhrase(),
                ex.getMessage(),
                ex.getCode(),
                ex.getStatus().value()));
  }

  @ExceptionHandler(RateLimitExceededException.class)
  public ResponseEntity<Map<String, Object>> handleRateLimit(RateLimitExceededException ex) {
    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
        .header("Retry-After", "5")
        .body(Map.of("error", "Too Many Requests", "message", ex.getMessage(), "statusCode", 429));
  }

  /**
   * Bad input that reached a controller without a typed exception (a null id, an unparseable
   * argument). Still a client error, so it keeps 400 — but the message is fixed text: Spring's own
   * wording ("The given id must not be null") is internal detail, and {@code
   * .claude/rules/no-raw-system-data-in-ui.md} forbids it reaching a user-facing surface.
   *
   * <p>{@code IllegalArgumentException} ONLY. {@code IllegalStateException} belongs to {@link
   * #handleGeneric}: in this service it means a server-side fault, not bad input — {@code
   * BotFactoryClient} throws it for "base URL is not configured" and for every failed upstream
   * call. Mapping it here reported an unconfigured or unreachable Bot Factory as "400 Bad request",
   * blaming the caller for an outage and hiding it from monitoring. That is the exact mislabelling
   * this handler was split out to stop.
   */
  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<Map<String, Object>> handleIllegalArgument(RuntimeException ex) {
    log.warn("Rejected request: {}", ex.toString());
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(Map.of("error", "Bad request", "statusCode", 400));
  }

  /**
   * Anything unhandled is a SERVER fault, not a client one. This previously answered 400 with
   * {@code ex.getMessage()} as the body, which both mislabelled real outages (a Mongo timeout or an
   * NPE looked like a bad request in the client and in monitoring) and echoed internal exception
   * text back to the caller. Log the detail, return an opaque 500.
   */
  @ExceptionHandler(RuntimeException.class)
  public ResponseEntity<Map<String, Object>> handleGeneric(RuntimeException ex) {
    log.error("Unhandled exception", ex);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", "Internal server error", "statusCode", 500));
  }

  /**
   * Error body shape shared by the coded handlers: {@code {error, message, statusCode}} plus a
   * top-level {@code code} when the failure has a stable reason ({@link ErrorCodes}). {@code
   * message} is English diagnostics; clients localize by {@code code}.
   */
  private static Map<String, Object> body(String error, String message, String code, int status) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("error", error);
    if (message != null) {
      body.put("message", message);
    }
    if (code != null) {
      body.put("code", code);
    }
    body.put("statusCode", status);
    return body;
  }
}
