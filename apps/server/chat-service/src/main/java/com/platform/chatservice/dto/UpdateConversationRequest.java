package com.platform.chatservice.dto;

/**
 * {@code PUT /api/conversations/{id}} (group admins). Every field is optional: {@code null} leaves
 * it unchanged. {@code publicChannel} toggles Explore visibility / self-join.
 */
public record UpdateConversationRequest(String name, String avatarUrl, Boolean publicChannel) {

  public UpdateConversationRequest(String name, String avatarUrl) {
    this(name, avatarUrl, null);
  }
}
