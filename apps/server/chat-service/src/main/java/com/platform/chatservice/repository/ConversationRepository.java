package com.platform.chatservice.repository;

import com.platform.chatservice.model.Conversation;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

public interface ConversationRepository extends MongoRepository<Conversation, String> {

  Page<Conversation> findByParticipantsContainingOrderByLastMessageAtDesc(
      String userId, Pageable pageable);

  Page<Conversation> findByParticipantsContainingAndBlockedByContainingOrderByLastMessageAtDesc(
      String participant, String blockedBy, Pageable pageable);

  long countByParticipantsContainingAndBlockedByContaining(String participant, String blockedBy);

  @Query("{ 'participants': { $all: ?0, $size: 2 } }")
  Optional<Conversation> findOneOnOneConversation(List<String> participants);

  /** Public group channels visible to all (Task 52). */
  @Query("{ 'publicChannel': true, 'type': 'group' }")
  Page<Conversation> findPublicGroups(Pageable pageable);

  @Query("{ 'publicChannel': true, 'type': 'group', 'name': { $regex: ?0, $options: 'i' } }")
  Page<Conversation> findPublicGroupsByName(String nameRegex, Pageable pageable);
}
