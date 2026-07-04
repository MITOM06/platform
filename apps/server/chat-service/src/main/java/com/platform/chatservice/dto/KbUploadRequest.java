package com.platform.chatservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class KbUploadRequest {

  @NotBlank private String conversationId;

  @Size(max = 255)
  private String fileName;

  @NotBlank
  @Size(max = 127)
  private String mimeType;

  // SSRF guard: fileUrl must point to a chat-service GridFS upload path. Clients
  // (web + mobile) send the RELATIVE `/api/uploads/{objectId}` returned by
  // UploadController; the additional absolute alternatives cover the Cloud Run
  // (*.run.app) deployment and local dev. This blocks metadata endpoints
  // (169.254.169.254), internal IPs, and arbitrary hosts outright.
  @NotBlank
  @Size(max = 1024)
  @Pattern(
      regexp =
          "^/api/uploads/[0-9a-f\\-]{24,36}$"
              + "|^https?://[^/]*\\.run\\.app/api/uploads/[0-9a-f\\-]{24,36}$"
              + "|^http://localhost:\\d+/api/uploads/[0-9a-f\\-]{24,36}$",
      message = "fileUrl must point to a valid upload path")
  private String fileUrl;
}
