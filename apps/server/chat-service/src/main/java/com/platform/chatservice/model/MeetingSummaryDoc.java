package com.platform.chatservice.model;

import java.time.Instant;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

/** One AI summary of a meeting as ai-service produced it; a regenerate adds a new row. */
@Document(collection = "meeting_summaries")
@CompoundIndex(name = "meeting_created", def = "{'meetingId': 1, 'createdAt': 1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MeetingSummaryDoc {

  @Id private String id;

  private String meetingId;

  /** The summary request this result answered. */
  private String attempt;

  private MeetingSummaryState status;

  /** {overview, keyPoints, decisions, actionItems, fromMaterials, language} as ai-service sent. */
  private Map<String, Object> summary;

  private Instant createdAt;
}
