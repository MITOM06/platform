package com.platform.chatservice.exception;

/**
 * Stable, machine-readable error codes returned as the top-level {@code code} field of an error
 * body (and of STOMP rejection events). Clients map these to localized strings — the {@code
 * message} field next to them is English diagnostic text and must never be shown to a user (see
 * {@code .claude/rules/no-raw-system-data-in-ui.md}).
 */
public final class ErrorCodes {

  /** 403 — the action is reserved to group admins (settings, members, pins, …). */
  public static final String GROUP_ADMIN_REQUIRED = "GROUP_ADMIN_REQUIRED";

  /** 403 — sending in a direct conversation where one side blocked the other. */
  public static final String USER_BLOCKED = "USER_BLOCKED";

  /** 400 — {@code replyToId} is unknown or belongs to another conversation. */
  public static final String REPLY_TARGET_INVALID = "REPLY_TARGET_INVALID";

  /** 400 — a client tried to store a message type (or system code) it may not create. */
  public static final String MESSAGE_TYPE_NOT_ALLOWED = "MESSAGE_TYPE_NOT_ALLOWED";

  /** 400 — malformed/unsupported URL (link preview). */
  public static final String INVALID_URL = "INVALID_URL";

  /** 400 — a query parameter could not be parsed (e.g. an {@code after} timestamp). */
  public static final String INVALID_PARAMETER = "INVALID_PARAMETER";

  /** 400 — first-time assistant setup without the required persona/model fields. */
  public static final String ASSISTANT_SETUP_INCOMPLETE = "ASSISTANT_SETUP_INCOMPLETE";

  /** 503 — Bot Factory and/or connector-service bridge is not configured on this deployment. */
  public static final String ASSISTANT_NOT_CONFIGURED = "ASSISTANT_NOT_CONFIGURED";

  /** 502 — a Bot Factory / connector-service call failed (orphans are cleaned up best-effort). */
  public static final String ASSISTANT_UPSTREAM_FAILED = "ASSISTANT_UPSTREAM_FAILED";

  /**
   * 409 — the conversation already has the maximum number of pinned messages ({@code params.max});
   * the oldest pin is never evicted silently. Unpin one first.
   */
  public static final String PIN_LIMIT_REACHED = "PIN_LIMIT_REACHED";

  /** 400 — a group-only action (admin promote/demote, …) on a direct conversation. */
  public static final String NOT_A_GROUP = "NOT_A_GROUP";

  /** 404 — the target user is not a (human) member of the conversation. */
  public static final String NOT_A_MEMBER = "NOT_A_MEMBER";

  /** 409 — demoting the group's only admin would leave it without one. */
  public static final String LAST_ADMIN_CANNOT_BE_REMOVED = "LAST_ADMIN_CANNOT_BE_REMOVED";

  /**
   * 400 — a department group cannot be a public channel: anyone could join it and read that
   * department's knowledge base through the group assistant.
   */
  public static final String PUBLIC_DEPARTMENT_CHANNEL_NOT_ALLOWED =
      "PUBLIC_DEPARTMENT_CHANNEL_NOT_ALLOWED";

  // ── Meetings (/api/meetings) ──────────────────────────────────────────────

  /** 404 — no meeting with this id / code. */
  public static final String MEETING_NOT_FOUND = "MEETING_NOT_FOUND";

  /** 403 — only the host / a co-host (or, to cancel, only the host) may do this. */
  public static final String MEETING_FORBIDDEN = "MEETING_FORBIDDEN";

  /** 403 — creating a meeting needs the {@code HOST_MEETING} capability. */
  public static final String MEETING_CREATE_FORBIDDEN = "MEETING_CREATE_FORBIDDEN";

  /**
   * 403 — inviting a department requires being a member of it or holding {@code
   * MANAGE_DEPARTMENTS}.
   */
  public static final String MEETING_DEPARTMENT_FORBIDDEN = "MEETING_DEPARTMENT_FORBIDDEN";

  /**
   * 400 — invalid create/update/list input; {@code params.field} names the field ({@code title |
   * description | inviteeIds | departmentId | scheduledStart | scheduledEnd | settings | scope}),
   * {@code params.max} the limit when one applies.
   */
  public static final String MEETING_INVALID = "MEETING_INVALID";

  /** 403 — the host removed this person from the meeting; they cannot enter again. */
  public static final String MEETING_REMOVED = "MEETING_REMOVED";

  /** 403 — the meeting is locked and this person is not invited. */
  public static final String MEETING_LOCKED = "MEETING_LOCKED";

  /** 409 — the meeting has ended (or was cancelled). */
  public static final String MEETING_ENDED = "MEETING_ENDED";

  /** 409 — the room already holds the maximum number of participants. */
  public static final String MEETING_FULL = "MEETING_FULL";

  /** 409 — only a SCHEDULED meeting nobody has entered yet can be cancelled. */
  public static final String MEETING_NOT_CANCELLABLE = "MEETING_NOT_CANCELLABLE";

  /** 503 — LiveKit is not configured on this deployment, or did not answer. */
  public static final String MEETINGS_UNAVAILABLE = "MEETINGS_UNAVAILABLE";

  /**
   * 409 — {@code PUT /api/meetings/{id}/notes/*} on a stale {@code version}; the body carries the
   * current note as {@code latest}.
   */
  public static final String MEETING_NOTE_CONFLICT = "MEETING_NOTE_CONFLICT";

  /** 403 — an attendee edits the shared note while {@code attendeesCanEditNotes} is off. */
  public static final String MEETING_NOTES_READ_ONLY = "MEETING_NOTES_READ_ONLY";

  // ── Rate limiting ─────────────────────────────────────────────────────────

  /**
   * Too many messages (10 per 5 s per person, chat and meeting chat together). Sent over STOMP
   * only: {@code {type: RATE_LIMITED}} on {@code /user/queue/notifications} for chat, {@code
   * meet.error} for meeting chat. The REST send returns HTTP 429.
   */
  public static final String RATE_LIMITED = "RATE_LIMITED";

  private ErrorCodes() {}
}
