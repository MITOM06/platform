package com.platform.chatservice.repository;

import com.platform.chatservice.model.Conversation;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

public interface ConversationRepository extends MongoRepository<Conversation, String> {

  Page<Conversation> findByParticipantsContainingOrderByLastMessageAtDesc(
      String userId, Pageable pageable);

  Page<Conversation> findByParticipantsContainingAndBlockedByContainingOrderByLastMessageAtDesc(
      String participant, String blockedBy, Pageable pageable);

  /**
   * The existing DM between exactly these two users, if any.
   *
   * <p>{@code 'type': 'direct'} is load-bearing: a 2-member GROUP has the same participants array,
   * so without it the query matched groups too. A user who shared a two-person group with someone
   * either got sent into that group when they tried to start a DM, or — once both a DM and such a
   * group existed — hit {@code IncorrectResultSizeDataAccessException} and could never open the DM
   * again.
   *
   * <p>Returns a list rather than {@code Optional} so a duplicate row (two concurrent creates
   * racing past this check) degrades to "reuse the oldest" instead of throwing. Sorted by {@code
   * createdAt} so every caller resolves to the same conversation.
   */
  @Query(
      value = "{ 'participants': { $all: ?0, $size: 2 }, 'type': 'direct' }",
      sort = "{ 'createdAt': 1 }")
  List<Conversation> findOneOnOneConversations(List<String> participants);

  /** Public group channels visible to all (Task 52). */
  @Query("{ 'publicChannel': true, 'type': 'group' }")
  Page<Conversation> findPublicGroups(Pageable pageable);

  @Query("{ 'publicChannel': true, 'type': 'group', 'name': { $regex: ?0, $options: 'i' } }")
  Page<Conversation> findPublicGroupsByName(String nameRegex, Pageable pageable);
}
