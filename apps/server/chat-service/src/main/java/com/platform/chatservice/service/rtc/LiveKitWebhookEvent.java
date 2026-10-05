package com.platform.chatservice.service.rtc;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** The fields of a LiveKit webhook the platform uses; everything else is ignored. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record LiveKitWebhookEvent(String id, String event, Room room, Participant participant) {

  public static final String PARTICIPANT_JOINED = "participant_joined";
  public static final String PARTICIPANT_LEFT = "participant_left";
  public static final String ROOM_FINISHED = "room_finished";

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Room(String name, String sid) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Participant(String identity, String name, String sid) {}
}
