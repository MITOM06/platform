package com.platform.chatservice.dto;

import java.time.Instant;

public record KbDocumentResponse(
    String documentId,
    String fileName,
    String mimeType,
    String status,
    int chunkCount,
    Instant uploadedAt
) {}
