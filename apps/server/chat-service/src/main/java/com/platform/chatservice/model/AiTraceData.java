package com.platform.chatservice.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Embedded subdocument stored on AI messages to record how the AI responded. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiTraceData {

    private List<String> thinkingBlocks;
    private List<ToolCallEntry> toolCalls;
    private int inputTokens;
    private int outputTokens;
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
