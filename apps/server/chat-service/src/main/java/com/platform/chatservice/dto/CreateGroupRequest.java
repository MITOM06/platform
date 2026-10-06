package com.platform.chatservice.dto;

import java.util.List;

/**
 * {@code POST /api/conversations/group}. {@code publicChannel} (null = false) makes the group a
 * public channel: listed in {@code GET /api/conversations/public} and joinable by anyone in the
 * workspace. A department group cannot be public ({@code 400
 * PUBLIC_DEPARTMENT_CHANNEL_NOT_ALLOWED}).
 */
public record CreateGroupRequest(
    String name,
    String avatarUrl,
    List<String> participantIds,
    String departmentId,
    Boolean publicChannel) {

  /** Private group (pre-F5 shape). */
  public CreateGroupRequest(
      String name, String avatarUrl, List<String> participantIds, String departmentId) {
    this(name, avatarUrl, participantIds, departmentId, null);
  }
}
