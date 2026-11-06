package com.platform.chatservice.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A file on a meeting chat line. {@code size} and {@code contentType} are read from GridFS at send
 * time, never taken from the client; {@code uploadId} is the id inside {@code url}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MeetingAttachment {

  private String uploadId;

  private String url;

  private String name;

  private long size;

  private String contentType;
}
