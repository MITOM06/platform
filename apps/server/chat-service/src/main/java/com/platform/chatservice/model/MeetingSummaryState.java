package com.platform.chatservice.model;

/** Lifecycle of a meeting's AI summary; {@code Meeting.summaryState == null} means never asked. */
public enum MeetingSummaryState {
  PENDING,
  DONE,
  EMPTY,
  FAILED
}
