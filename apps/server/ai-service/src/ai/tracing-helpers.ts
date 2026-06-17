/**
 * OpenTelemetry helpers for the AI agentic loop.
 * Kept in a separate file to stay within the 500-line limit for ai.service.ts.
 */

import {
  trace,
  context,
  SpanStatusCode,
  SpanKind,
  metrics,
  type Span,
} from '@opentelemetry/api';
import type { AiTrace } from './ai.service';

const tracer = trace.getTracer('ai-service');
const meter = metrics.getMeter('ai-service');

// Token counter: incremented for both input and output tokens.
const tokenCounter = meter.createCounter('ai.tokens', {
  description: 'Cumulative AI tokens consumed',
  unit: '{token}',
});

/**
 * Wraps the agentic loop in an OTel span and records AI-specific attributes
 * and metrics after the loop completes.
 *
 * @param model     The model selected by the router for this request.
 * @param conversationId  For span attribute logging.
 * @param fn        Factory that receives the span and returns the AiTrace.
 */
export async function withAgenticLoopSpan(
  model: string,
  conversationId: string,
  fn: (span: Span) => Promise<AiTrace>,
): Promise<AiTrace> {
  const span = tracer.startSpan('ai.agentic_loop', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'ai.model': model,
      'ai.conversation_id': conversationId,
    },
  });

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const traceResult = await fn(span);

      // Enrich span with post-loop metrics.
      span.setAttributes({
        'ai.input_tokens': traceResult.inputTokens,
        'ai.output_tokens': traceResult.outputTokens,
        'ai.thinking_tokens': traceResult.thinkingTokens,
        'ai.tool_rounds': traceResult.iterationCount,
        'ai.latency_ms': traceResult.processingMs,
        'ai.model': traceResult.model,
      });

      // Record token counts as metrics with direction + model dimensions.
      tokenCounter.add(traceResult.inputTokens, {
        direction: 'input',
        model: traceResult.model,
      });
      tokenCounter.add(traceResult.outputTokens, {
        direction: 'output',
        model: traceResult.model,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return traceResult;
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}
