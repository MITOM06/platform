package com.platform.chatservice.dto.meeting;

import com.fasterxml.jackson.annotation.JsonInclude;

/** The file on a meeting chat line; the upload id is already inside {@code url}. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MeetingAttachmentDto(String url, String name, long size, String contentType) {}
