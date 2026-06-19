package com.platform.chatservice.dto;

import com.platform.chatservice.model.AiTraceData;
import java.util.List;
import java.util.stream.Collectors;

public record AiTraceResponse(
    List<String> thinkingBlocks,
    List<ToolCallEntry> toolCalls,
    int inputTokens,
    int outputTokens,
    int thinkingTokens,
    int processingMs,
    String model,
    int iterationCount) {
  public record ToolCallEntry(String toolName, String inputSummary, String resultSummary) {}

  public static AiTraceResponse from(AiTraceData data) {
    List<ToolCallEntry> entries =
        data.getToolCalls() == null
            ? List.of()
            : data.getToolCalls().stream()
                .map(
                    t ->
                        new ToolCallEntry(
                            t.getToolName(), t.getInputSummary(), t.getResultSummary()))
                .collect(Collectors.toList());
    return new AiTraceResponse(
        data.getThinkingBlocks() == null ? List.of() : data.getThinkingBlocks(),
        entries,
        data.getInputTokens(),
        data.getOutputTokens(),
        data.getThinkingTokens(),
        data.getProcessingMs(),
        data.getModel(),
        data.getIterationCount());
  }
}
