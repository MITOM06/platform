package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/** One in-meeting chat line. Text only — never a file or a system message. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MeetingMessageDto(String id, PersonDto sender, String content, Instant createdAt) {}
