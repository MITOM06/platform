package com.platform.chatservice.repository;

import com.platform.chatservice.model.MeetingNote;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface MeetingNoteRepository extends MongoRepository<MeetingNote, String> {}
