package com.platform.chatservice.repository;

import com.platform.chatservice.model.Reminder;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ReminderRepository extends MongoRepository<Reminder, String> {

    List<Reminder> findByUserIdAndDoneFalseOrderByRemindAtAsc(String userId);

    Optional<Reminder> findByIdAndUserId(String id, String userId);
}
