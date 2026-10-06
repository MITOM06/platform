package com.platform.chatservice.exception;

import org.springframework.http.HttpStatus;

/**
 * An expected API failure with a stable machine code the clients map to a localized message (e.g.
 * {@code CALL_FORBIDDEN}). The body never carries internal detail.
 */
public class ApiException extends RuntimeException {

  private final HttpStatus status;
  private final String code;

  public ApiException(HttpStatus status, String code) {
    super(code);
    this.status = status;
    this.code = code;
  }

  public HttpStatus status() {
    return status;
  }

  public String code() {
    return code;
  }
}
