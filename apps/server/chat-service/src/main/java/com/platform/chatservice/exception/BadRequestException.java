package com.platform.chatservice.exception;

import lombok.Getter;

/** 400. {@code code} (optional) is the stable machine-readable reason, see {@link ErrorCodes}. */
@Getter
public class BadRequestException extends RuntimeException {

  private final String code;

  public BadRequestException(String message) {
    this(null, message);
  }

  public BadRequestException(String code, String message) {
    super(message);
    this.code = code;
  }
}
