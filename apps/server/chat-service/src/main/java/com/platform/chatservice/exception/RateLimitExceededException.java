package com.platform.chatservice.exception;

public class RateLimitExceededException extends RuntimeException {
  public RateLimitExceededException() {
    super("Too many requests. Please slow down.");
  }
}
