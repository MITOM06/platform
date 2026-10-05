package com.platform.chatservice.exception;

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

  public ApiException(HttpStatus status, String code, String message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  public ApiException(HttpStatus status, String code, String message, Throwable cause) {
    super(message, cause);
    this.status = status;
    this.code = code;
  }
}
