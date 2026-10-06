package com.platform.chatservice.service.rtc;

/** A LiveKit room-API call failed. {@code status} is the HTTP status, or -1 for a network error. */
public class LiveKitApiException extends RuntimeException {

  private final String method;
  private final int status;

  public LiveKitApiException(String method, int status, Throwable cause) {
    super("LiveKit " + method + " failed (status " + status + ")", cause);
    this.method = method;
    this.status = status;
  }

  public String method() {
    return method;
  }

  public int status() {
    return status;
  }
}
