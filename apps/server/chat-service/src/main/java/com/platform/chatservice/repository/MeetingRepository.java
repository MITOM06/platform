package com.platform.chatservice.repository;

import com.platform.chatservice.model.Meeting;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

/**
 * Reads and the first insert of {@link Meeting}s. Every later write goes through {@code
 * MeetingStore} as an atomic update — never {@code save()} an existing meeting.
 */
public interface MeetingRepository extends MongoRepository<Meeting, String> {

  Optional<Meeting> findByCode(String code);
}
