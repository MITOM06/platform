package com.platform.chatservice.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "kb_documents")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KbDocument {

    @Id
    private String id;

    @Indexed(unique = true)
    private String documentId;

    @Indexed
    private String conversationId;

    private String userId;
    private String fileName;
    private String mimeType;
    private String fileUrl;

    @Builder.Default
    private String status = "pending"; // "pending" | "processing" | "done" | "error"

    @Builder.Default
    private int chunkCount = 0;

    @CreatedDate
    private Instant uploadedAt;
}
