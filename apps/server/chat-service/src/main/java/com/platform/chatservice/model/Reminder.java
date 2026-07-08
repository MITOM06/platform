package com.platform.chatservice.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "reminders")
@CompoundIndexes({
  // User-facing list: "my undone reminders sorted by time" (ReminderController#getReminders)
  @CompoundIndex(name = "user_done_remind", def = "{'userId': 1, 'done': 1, 'remindAt': 1}"),
  // Delivery sweep: "all due, undone, not-yet-notified reminders" (ReminderSweepService)
  @CompoundIndex(name = "due_sweep", def = "{'done': 1, 'notified': 1, 'remindAt': 1}"),
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Reminder {

  @Id private String id;

  private String userId;

  private String conversationId;

  private String text;

  private Instant remindAt;

  @Builder.Default private boolean done = false;

  /** True once a push notification has been delivered, so the sweep never re-sends. */
  @Builder.Default private boolean notified = false;

  /**
   * Number of delivery attempts that failed AFTER the reminder was claimed. Incremented for
   * observability only — the sweep does not retry claimed-then-failed reminders (single-delivery,
   * at-least-effort), so this never resets {@code notified}.
   */
  @Builder.Default private int attempts = 0;

  @Builder.Default private Instant createdAt = Instant.now();
}
