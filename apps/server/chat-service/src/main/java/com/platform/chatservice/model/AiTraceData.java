package com.platform.chatservice.model;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Embedded subdocument stored on AI messages to record how the AI responded. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiTraceData {

  private List<String> thinkingBlocks;
  private List<ToolCallEntry> toolCalls;

  /** TOTAL prompt tokens of the reply — cache writes and reads included. */
  private int inputTokens;

  private int outputTokens;

  /**
   * Prompt-cache READS (subset of {@code inputTokens}), as ai-service names it in the DONE trace.
   * Read by ai-service's usage dashboard ({@code trace.cachedInputTokens}) to price cached input at
   * the discounted rate instead of the full one.
   */
  private int cachedInputTokens;

  /** Prompt-cache WRITES (subset of {@code inputTokens}). */
  private int cacheCreationInputTokens;

  private int thinkingTokens;
  private int processingMs;
  private String model;
  private int iterationCount;

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class ToolCallEntry {
    private String toolName;
    private String inputSummary;
    private String resultSummary;
  }
}
