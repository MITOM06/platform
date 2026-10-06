package com.platform.chatservice.service.rtc;

/** LiveKit is not configured on this deployment (url, key or secret blank). */
public class LiveKitUnavailableException extends RuntimeException {
  public LiveKitUnavailableException() {
    super("LiveKit is not configured");
  }
}
