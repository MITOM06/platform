package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
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

  /** {@code meet.roster | meet.settings | meet.ended | meet.lobby | meet.admitted | …}. */
  private String event;

  private String meetingId;

  private String code;

  private String title;

  private String hostId;

  private String hostName;

  private Instant scheduledStart;

  private List<AttendanceDto> participants;

  private List<LobbyEntryDto> waiting;

  private MeetingSettingsDto settings;
}
