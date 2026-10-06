package com.platform.chatservice.exception;

import lombok.Getter;

/** 403. {@code code} (optional) is the stable machine-readable reason, see {@link ErrorCodes}. */
@Getter
public class ForbiddenException extends RuntimeException {

  private final String code;

  public ForbiddenException(String message) {
    this(null, message);
  }

  public ForbiddenException(String code, String message) {
    super(message);
    this.code = code;
  }
}
