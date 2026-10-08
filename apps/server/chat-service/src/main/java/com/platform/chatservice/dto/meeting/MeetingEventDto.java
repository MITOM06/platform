package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Every meeting STOMP payload ({@code /topic/meeting/{id}} and {@code /user/queue/meeting}). Only
 * the fields relevant to {@code event} are set; the rest are omitted. Never carries the LiveKit
 * room name.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MeetingEventDto {

  /**
   * Room ({@code /topic/meeting/{id}}): {@code meet.roster | meet.settings | meet.ended |
   * meet.hands | meet.chat | meet.notes.updated}. Personal ({@code /user/queue/meeting}): {@code
   * meet.lobby | meet.admitted | meet.denied | meet.ended | meet.invited | meet.starting |
   * meet.cancelled | meet.removed | meet.muted | meet.error}.
   */
  private String event;

  private String meetingId;

  /** The meeting's shareable code ({@code abc-defg-hjk}) — never an error code. */
  private String code;

  private String title;

  private String hostId;

  private String hostName;

  private Instant scheduledStart;

  private List<AttendanceDto> participants;

  private List<LobbyEntryDto> waiting;

  private MeetingSettingsDto settings;

  /** {@code meet.hands}: raised hands in raise order; {@code []} when nobody has a hand up. */
  private List<HandDto> hands;

  /** {@code meet.chat}. */
  private MeetingMessageDto message;

  /** {@code meet.notes.updated}: the shared note's new version (never its text). */
  private Long version;

  /** {@code meet.notes.updated}: who saved the shared note. */
  private PersonDto updatedBy;

  /** {@code meet.muted}: the host / co-host who muted you. */
  private PersonDto actor;

  /** {@code meet.error}: the host command that was refused. */
  private String action;

  /** {@code meet.chat} / {@code meet.error}: echo of the sender's optional chat client id. */
  private String clientId;

  /** {@code meet.error}: an {@code ErrorCodes} value. */
  private String errorCode;

  /** {@code meet.error}: interpolation values ({@code field}, {@code max}) — never user text. */
  private Map<String, Object> params;
}
