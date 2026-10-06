package com.platform.chatservice.exception;

import java.util.Map;
import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * An expected API failure with an explicit HTTP status and a stable {@link ErrorCodes code} the
 * clients map to a localized message (e.g. {@code CALL_FORBIDDEN}, or 502 / 503 from the
 * personal-assistant bridge). The body never carries internal detail.
 */
@Getter
public class ApiException extends RuntimeException {

  private final HttpStatus status;
  private final String code;

  /**
   * Optional interpolation values for the client's localized message (e.g. {@code {max: 5}}),
   * returned as the top-level {@code params} field. Never user text — clients format it.
   */
  private final Map<String, Object> params;

  /** Code-only failure: the body carries no {@code message} — clients localize the code. */
  public ApiException(HttpStatus status, String code) {
    this(status, code, (String) null);
  }

  public ApiException(HttpStatus status, String code, String message) {
    this(status, code, message, (Map<String, Object>) null);
  }

  public ApiException(HttpStatus status, String code, String message, Throwable cause) {
    super(message, cause);
    this.status = status;
    this.code = code;
    this.params = null;
  }

  public ApiException(HttpStatus status, String code, String message, Map<String, Object> params) {
    super(message);
    this.status = status;
    this.code = code;
    this.params = params == null || params.isEmpty() ? null : Map.copyOf(params);
  }

  public HttpStatus status() {
    return status;
  }

  public String code() {
    return code;
  }
}
