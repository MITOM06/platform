package com.platform.chatservice.dto;

import lombok.Data;

@Data
public class KbUploadRequest {
  private String conversationId;
  private String fileName;
  private String mimeType;
  private String fileUrl;
}
