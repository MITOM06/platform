package com.platform.chatservice.service;

import com.platform.chatservice.dto.ConversationResponse;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.ErrorCodes;
import com.platform.chatservice.model.Conversation;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Promote / demote group admins (F4). Rules:
 *
 * <ul>
 *   <li>groups only — {@code 400 NOT_A_GROUP}; the caller must be a participant (404 otherwise, as
 *       everywhere) and a group admin — {@code 403 GROUP_ADMIN_REQUIRED};
 *   <li>the target must be a human participant — {@code 404 NOT_A_MEMBER} (bots never administer a
 *       group: they would count as "another admin" and let the last human admin step down);
 *   <li>promoting an admin / demoting a non-admin is an idempotent no-op ({@code changed=false});
 *   <li>demoting the only admin — {@code 409 LAST_ADMIN_CANNOT_BE_REMOVED}; self-demotion is fine
 *       while another admin exists.
 * </ul>
 *
 * Each write is ONE guarded {@code findAndModify} ({@code $addToSet} / {@code $pull} on {@code
 * admins}) whose filter re-asserts the preconditions — caller still admin, target still a member,
 * at least two admins before a demotion — so two admins demoting each other at the same time can
 * never leave the group without one. A write that loses such a race re-reads and re-decides once.
 */
@Service
@RequiredArgsConstructor
public class GroupAdminService {

  private static final int ATTEMPTS = 3;

  private final ConversationWriteSupport support;

  /** Outcome: the caller's view of the conversation, and whether {@code admins} really changed. */
  public record AdminChange(ConversationResponse conversation, boolean changed) {}

  public AdminChange promote(String actorId, String conversationId, String targetUserId) {
    for (int attempt = 0; attempt < ATTEMPTS; attempt++) {
      Conversation conversation = requireAdminOfGroup(actorId, conversationId);
      requireHumanMember(conversation, targetUserId);
      if (ConversationWriteSupport.isAdmin(conversation, targetUserId)) {
        return new AdminChange(support.view(conversation, actorId), false);
      }
      Conversation updated =
          support.update(
              conversationId,
              Criteria.where("admins").is(actorId).and("participants").is(targetUserId),
              new Update().addToSet("admins", targetUserId));
      if (updated != null) {
        return new AdminChange(support.view(updated, actorId), true);
      }
      // Lost a race (caller demoted / target removed meanwhile): re-read and decide again.
    }
    throw concurrentChange();
  }

  public AdminChange demote(String actorId, String conversationId, String targetUserId) {
    for (int attempt = 0; attempt < ATTEMPTS; attempt++) {
      Conversation conversation = requireAdminOfGroup(actorId, conversationId);
      requireMember(conversation, targetUserId);
      if (!ConversationWriteSupport.isAdmin(conversation, targetUserId)) {
        return new AdminChange(support.view(conversation, actorId), false);
      }
      if (conversation.getAdmins().size() < 2) {
        throw new ApiException(
            HttpStatus.CONFLICT,
            ErrorCodes.LAST_ADMIN_CANNOT_BE_REMOVED,
            "A group needs at least one admin");
      }
      Conversation updated =
          support.update(
              conversationId,
              Criteria.where("admins").all(actorId, targetUserId).and("admins.1").exists(true),
              new Update().pull("admins", targetUserId));
      if (updated != null) {
        return new AdminChange(support.view(updated, actorId), true);
      }
      // Lost a race (another demotion landed first): re-read and decide again.
    }
    throw concurrentChange();
  }

  /** Participant (404) of a group (400 NOT_A_GROUP) who is one of its admins (403). */
  private Conversation requireAdminOfGroup(String actorId, String conversationId) {
    Conversation conversation = support.requireParticipant(actorId, conversationId);
    if (!conversation.isGroup()) {
      throw ConversationWriteSupport.notAGroup();
    }
    if (!ConversationWriteSupport.isAdmin(conversation, actorId)) {
      throw ConversationWriteSupport.adminRequired("Only admins can change group admins");
    }
    return conversation;
  }

  private static void requireMember(Conversation conversation, String userId) {
    if (userId == null
        || conversation.getParticipants() == null
        || !conversation.getParticipants().contains(userId)) {
      throw notAMember();
    }
  }

  private static void requireHumanMember(Conversation conversation, String userId) {
    requireMember(conversation, userId);
    if (AiConstants.AI_BOT_USER_ID.equals(userId) || userId.startsWith("extbot:")) {
      throw notAMember();
    }
  }

  private static ApiException notAMember() {
    return new ApiException(
        HttpStatus.NOT_FOUND, ErrorCodes.NOT_A_MEMBER, "User is not a member of this group");
  }

  private static ApiException concurrentChange() {
    return new ApiException(
        HttpStatus.CONFLICT, null, "The group's admins changed concurrently; retry");
  }
}
