package com.platform.chatservice.service.rtc;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.config.LiveKitProperties;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * The slice of LiveKit's RoomService the platform needs (host controls, ending a room). Twirp over
 * JSON with the JDK HttpClient, so there is no LiveKit SDK on the server.
 */
@Service
public class LiveKitRoomClient {

  private static final String SERVICE_PATH = "/twirp/livekit.RoomService/";
  private static final Duration TIMEOUT = Duration.ofSeconds(5);

  /** livekit.TrackSource numbering, for servers that send the enum as a number. */
  private static final List<String> SOURCES =
      List.of("UNKNOWN", "CAMERA", "MICROPHONE", "SCREEN_SHARE", "SCREEN_SHARE_AUDIO");

  public record RoomTrack(String sid, String source, boolean muted) {}

  public record RoomParticipant(String identity, String name, List<RoomTrack> tracks) {}

  private final LiveKitProperties props;
  private final LiveKitTokenService tokens;
  private final ObjectMapper objectMapper;
  private final HttpClient http;

  @Autowired
  public LiveKitRoomClient(
      LiveKitProperties props, LiveKitTokenService tokens, ObjectMapper objectMapper) {
    this(props, tokens, objectMapper, HttpClient.newBuilder().connectTimeout(TIMEOUT).build());
  }

  LiveKitRoomClient(
      LiveKitProperties props,
      LiveKitTokenService tokens,
      ObjectMapper objectMapper,
      HttpClient http) {
    this.props = props;
    this.tokens = tokens;
    this.objectMapper = objectMapper;
    this.http = http;
  }

  public List<RoomParticipant> listParticipants(String room) {
    JsonNode body = call("ListParticipants", room, Map.of("room", room));
    List<RoomParticipant> out = new ArrayList<>();
    for (JsonNode p : body.path("participants")) {
      List<RoomTrack> tracks = new ArrayList<>();
      for (JsonNode t : p.path("tracks")) {
        tracks.add(
            new RoomTrack(
                t.path("sid").asText(null), source(t.path("source")), t.path("muted").asBoolean()));
      }
      out.add(
          new RoomParticipant(
              p.path("identity").asText(null), p.path("name").asText(null), tracks));
    }
    return out;
  }

  public void mutePublishedTrack(String room, String identity, String trackSid, boolean muted) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("room", room);
    body.put("identity", identity);
    body.put("track_sid", trackSid);
    body.put("muted", muted);
    call("MutePublishedTrack", room, body);
  }

  public void removeParticipant(String room, String identity) {
    call("RemoveParticipant", room, Map.of("room", room, "identity", identity));
  }

  /**
   * Creates {@code room} with explicit lifetimes before anyone joins. LiveKit returns the existing
   * room when it already exists, so calling it on every join is harmless. {@code
   * departureTimeoutSeconds} is how long a room that had people stays open once empty — without it
   * a host dropping off the network for LiveKit's default ~20 s would end the meeting.
   */
  public void createRoom(
      String room, int emptyTimeoutSeconds, int departureTimeoutSeconds, int maxParticipants) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("name", room);
    body.put("empty_timeout", emptyTimeoutSeconds);
    body.put("departure_timeout", departureTimeoutSeconds);
    body.put("max_participants", maxParticipants);
    call("CreateRoom", room, body);
  }

  public void deleteRoom(String room) {
    call("DeleteRoom", room, Map.of("room", room));
  }

  private JsonNode call(String method, String room, Map<String, Object> body) {
    if (!props.isConfigured()) {
      throw new LiveKitUnavailableException();
    }
    HttpRequest request;
    try {
      request =
          HttpRequest.newBuilder(URI.create(props.resolvedApiUrl() + SERVICE_PATH + method))
              .timeout(TIMEOUT)
              .header("Content-Type", "application/json")
              .header("Authorization", "Bearer " + tokens.serverToken(room))
              .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
              .build();
    } catch (JsonProcessingException e) {
      throw new LiveKitApiException(method, -1, e);
    }
    try {
      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() / 100 != 2) {
        throw new LiveKitApiException(method, response.statusCode(), null);
      }
      String text = response.body();
      return objectMapper.readTree(text == null || text.isBlank() ? "{}" : text);
    } catch (IOException e) {
      throw new LiveKitApiException(method, -1, e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new LiveKitApiException(method, -1, e);
    }
  }

  private static String source(JsonNode node) {
    if (node.isNumber()) {
      int i = node.asInt();
      return i >= 0 && i < SOURCES.size() ? SOURCES.get(i) : "UNKNOWN";
    }
    String text = node.asText("");
    return SOURCES.contains(text) ? text : "UNKNOWN";
  }
}
