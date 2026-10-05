package com.platform.chatservice.model;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A sensitive AI tool call waiting for the requester's in-chat confirmation (F2). Embedded in the
 * AI {@link Message} whose reply asked for it ({@code pendingActions[]}), copied from ai-service's
 * {@code AI_STREAM_DONE.pendingActions}. Only display data lives here — the tool input stays in
 * ai-service's {@code ai:pending-action:{id}} key, so nothing secret reaches clients.
 *
 * <p>{@code status} starts {@link #STATUS_PENDING} and is flipped once by ai-service's {@code
 * ai:action:resolved} event to {@code confirmed | failed | cancelled}. "Expired" is never stored:
 * clients derive it from {@code expiresAt}.
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class PendingAction {

  public static final String STATUS_PENDING = "pending";
  public static final String STATUS_CONFIRMED = "confirmed";
  public static final String STATUS_FAILED = "failed";
  public static final String STATUS_CANCELLED = "cancelled";

  /** Terminal statuses ai-service may publish on {@code ai:action:resolved}. */
  public static final Set<String> RESOLVED_STATUSES =
      Set.of(STATUS_CONFIRMED, STATUS_FAILED, STATUS_CANCELLED);

  /** ai-service pending-action id (uuid) — the confirm/cancel route parameter. */
  private String id;

  private String toolName;

  private String provider;

  /** Humanized, non-secret description built by ai-service ({@code {kind, …}}). */
  private Map<String, Object> summary;

  private String status;

  private Instant expiresAt;

  /** The user who asked the AI — the only one who may confirm or cancel. */
  private String requesterId;
}
