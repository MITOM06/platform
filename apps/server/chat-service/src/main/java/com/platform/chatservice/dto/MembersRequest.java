package com.platform.chatservice.dto;

import java.util.List;

public record MembersRequest(List<String> userIds) {}
