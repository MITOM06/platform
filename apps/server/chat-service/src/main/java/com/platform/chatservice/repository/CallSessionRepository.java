package com.platform.chatservice.repository;

import com.platform.chatservice.model.CallSession;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface CallSessionRepository extends MongoRepository<CallSession, String> {

  Optional<CallSession> findByCallId(String callId);
}
