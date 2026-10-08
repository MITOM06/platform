package com.platform.chatservice.repository;

import com.platform.chatservice.model.MeetingMessage;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface MeetingMessageRepository extends MongoRepository<MeetingMessage, String> {}
