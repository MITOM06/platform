package com.platform.chatservice.repository;

import com.platform.chatservice.model.Reminder;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ReminderRepository extends MongoRepository<Reminder, String> {

  List<Reminder> findByUserIdAndDoneFalseOrderByRemindAtAsc(String userId);

  Optional<Reminder> findByIdAndUserId(String id, String userId);

  /** Due reminders awaiting their first push delivery. Backed by the {@code due_sweep} index. */
  List<Reminder> findByDoneFalseAndNotifiedFalseAndRemindAtLessThanEqual(Instant cutoff);
}
