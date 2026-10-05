package com.platform.chatservice.service.rtc;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** What a LiveKit access token lets its holder do in one room. */
public record RtcGrant(
    String room,
    boolean canPublish,
    boolean canSubscribe,
    boolean canPublishData,
    boolean roomAdmin,
    List<String> canPublishSources) {

  public static final String CAMERA = "camera";
  public static final String MICROPHONE = "microphone";
  public static final String SCREEN_SHARE = "screen_share";
  public static final String SCREEN_SHARE_AUDIO = "screen_share_audio";

  /** Publish, subscribe and send data in {@code room}; every source allowed. */
  public static RtcGrant participant(String room) {
    return new RtcGrant(room, true, true, true, false, null);
  }

  public RtcGrant withSources(List<String> sources) {
    return new RtcGrant(
        room, canPublish, canSubscribe, canPublishData, roomAdmin, List.copyOf(sources));
  }

  public RtcGrant asRoomAdmin() {
    return new RtcGrant(room, canPublish, canSubscribe, canPublishData, true, canPublishSources);
  }

  /** The {@code video} claim LiveKit reads. Optional grants are omitted rather than false. */
  Map<String, Object> toVideoClaim() {
    Map<String, Object> video = new LinkedHashMap<>();
    video.put("room", room);
    video.put("roomJoin", true);
    video.put("canPublish", canPublish);
    video.put("canSubscribe", canSubscribe);
    video.put("canPublishData", canPublishData);
    if (roomAdmin) {
      video.put("roomAdmin", true);
    }
    if (canPublishSources != null) {
      video.put("canPublishSources", canPublishSources);
    }
    return video;
  }
}
