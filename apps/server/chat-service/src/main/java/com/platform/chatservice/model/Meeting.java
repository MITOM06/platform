package com.platform.chatservice.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * A meeting room (Meet/Teams style), always hosted on LiveKit in room {@code meet_{id}}.
 *
 * <p>After the first insert this document is only ever changed through atomic updates in {@code
 * MeetingStore} — LiveKit webhooks for many participants arrive concurrently and a whole-document
 * {@code save()} would overwrite each other's attendance rows.
 */
@Document(collection = "meetings")
@CompoundIndexes({
  @CompoundIndex(name = "host_sort", def = "{'hostId': 1, 'sortAt': 1}"),
  @CompoundIndex(name = "cohost_sort", def = "{'coHostIds': 1, 'sortAt': 1}"),
  @CompoundIndex(name = "invitee_sort", def = "{'inviteeIds': 1, 'sortAt': 1}"),
  @CompoundIndex(name = "dept_sort", def = "{'departmentId': 1, 'sortAt': 1}"),
  @CompoundIndex(name = "status_start", def = "{'status': 1, 'scheduledStart': 1}"),
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Meeting {

  @Id private String id;

  /** Shareable code {@code xxx-xxxx-xxx}, see {@code MeetingCodeGenerator}. */
  @Indexed(unique = true)
  private String code;

  /** User-entered title; null means the client shows its own localized default. */
  private String title;

  private String description;

  private String hostId;

  @Builder.Default private List<String> coHostIds = new ArrayList<>();

  @Builder.Default private List<String> inviteeIds = new ArrayList<>();

  /** Every member of this department is invited (resolved from the {@code depts} claim). */
  private String departmentId;

  /** Null for an instant meeting. */
  private Instant scheduledStart;

  private Instant scheduledEnd;

  /** {@code scheduledStart ?? createdAt} — list ordering only, never returned to clients. */
  private Instant sortAt;

  @Builder.Default private MeetingStatus status = MeetingStatus.SCHEDULED;

  @Builder.Default private Settings settings = new Settings();

  /** People the host removed from the meeting; they can never enter again. */
  @Builder.Default private List<String> removedIds = new ArrayList<>();

  /** One row per session in the room; a person who comes back gets a new row. */
  @Builder.Default private List<Attendance> attendance = new ArrayList<>();

  /** Whether the 10-minute "starting soon" reminder was already claimed by a sweep. */
  private boolean reminded;

  private Instant createdAt;

  private Instant startedAt;

  private Instant endedAt;

  private Instant cancelledAt;

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class Settings {
    @Builder.Default private boolean waitingRoom = true;

    /** Client hint only: join with the microphone off. */
    private boolean muteOnEntry;

    @Builder.Default private boolean allowAttendeeScreenShare = true;

    @Builder.Default private boolean attendeesCanEditNotes = true;

    private boolean locked;
  }

  /** One session of one person in the room. */
  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class Attendance {
    private String userId;

    private String displayName;

    /** "host" | "cohost" | "attendee" at join time. */
    private String role;

    /** LiveKit participant sid of this session. */
    private String sid;

    private Instant joinedAt;

    /** Null while the person is still in the room. */
    private Instant leftAt;
  }
}
