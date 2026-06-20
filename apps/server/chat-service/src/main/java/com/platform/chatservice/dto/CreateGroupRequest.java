package com.platform.chatservice.dto;

import java.util.List;

public record CreateGroupRequest(
    String name, String avatarUrl, List<String> participantIds, String departmentId) {}
