package com.platform.chatservice.exception;

import java.util.Map;
import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * An error with an explicit HTTP status and a stable {@link ErrorCodes code}, for statuses that
 * have no dedicated exception type (e.g. 502 / 503 from the personal-assistant bridge).
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
}
