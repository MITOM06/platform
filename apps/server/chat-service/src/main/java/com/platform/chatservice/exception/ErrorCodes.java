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

  private ErrorCodes() {}
}
