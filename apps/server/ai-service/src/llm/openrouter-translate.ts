import Anthropic from '@anthropic-ai/sdk';

/**
 * Anthropic Messages ⇄ OpenAI Chat Completions translation for OpenRouter.
 *
 * OpenRouter only speaks the OpenAI format, while every caller in ai-service is
 * written against the Anthropic SDK (system blocks, tool_use / tool_result
 * blocks, streaming events). Translating at the edge keeps the agentic loop,
 * the tool rounds and the confirmation-card hold untouched. Anthropic-only
 * request fields (cache_control, output_config, thinking) are dropped.
 */

export interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type OpenAiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type OpenAiMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | OpenAiContentPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenAiToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface OpenAiChatRequest {
  model: string;
  messages: OpenAiMessage[];
  max_tokens?: number;
  temperature?: number;
  tools?: Array<{
    type: 'function';
    function: { name: string; description?: string; parameters: unknown };
  }>;
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
}

export interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

/** Fields shared by Anthropic's streaming and non-streaming create params. */
export type AnthropicRequest = Pick<
  Anthropic.MessageCreateParams,
  'model' | 'max_tokens' | 'system' | 'messages' | 'tools' | 'tool_choice' | 'temperature'
>;

export function toOpenAiRequest(params: AnthropicRequest): OpenAiChatRequest {
  const messages: OpenAiMessage[] = [];
  const system = systemText(params.system);
  if (system) messages.push({ role: 'system', content: system });
  for (const m of params.messages) messages.push(...toOpenAiMessages(m));

  const request: OpenAiChatRequest = {
    model: params.model,
    messages,
    max_tokens: params.max_tokens,
  };
  if (typeof params.temperature === 'number') request.temperature = params.temperature;

  const tools = (params.tools ?? [])
    .filter((t): t is Anthropic.Tool => 'input_schema' in t)
    .map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
  if (tools.length > 0) {
    request.tools = tools;
    request.tool_choice = toolChoice(params.tool_choice);
  }
  return request;
}

function systemText(system: AnthropicRequest['system']): string {
  if (!system) return '';
  if (typeof system === 'string') return system.trim();
  return system
    .map((b) => b.text)
    .filter((t) => t.trim())
    .join('\n\n');
}

function toolChoice(choice: Anthropic.ToolChoice | undefined): OpenAiChatRequest['tool_choice'] {
  switch (choice?.type) {
    case 'any':
      return 'required';
    case 'none':
      return 'none';
    case 'tool':
      return { type: 'function', function: { name: choice.name } };
    default:
      return 'auto';
  }
}

/**
 * One Anthropic turn → one or more OpenAI messages. A user turn carrying
 * tool_result blocks becomes `tool` messages first (they must directly follow
 * the assistant's tool_calls), then any remaining text/images as a user turn.
 */
function toOpenAiMessages(m: Anthropic.MessageParam): OpenAiMessage[] {
  if (typeof m.content === 'string') {
    return m.role === 'user'
      ? [{ role: 'user', content: m.content }]
      : [{ role: 'assistant', content: m.content }];
  }
  if (m.role === 'assistant') return [assistantMessage(m.content)];

  const out: OpenAiMessage[] = [];
  const parts: OpenAiContentPart[] = [];
  for (const block of m.content) {
    if (block.type === 'tool_result') {
      out.push({
        role: 'tool',
        tool_call_id: block.tool_use_id,
        content: toolResultText(block),
      });
    } else if (block.type === 'text') {
      parts.push({ type: 'text', text: block.text });
    } else if (block.type === 'image') {
      const url = imageUrl(block);
      if (url) parts.push({ type: 'image_url', image_url: { url } });
    }
  }
  if (parts.length > 0) {
    const onlyText = parts.every((p) => p.type === 'text');
    out.push({
      role: 'user',
      content: onlyText ? parts.map((p) => (p as { text: string }).text).join('\n') : parts,
    });
  }
  return out;
}

function assistantMessage(blocks: Anthropic.ContentBlockParam[]): OpenAiMessage {
  const text: string[] = [];
  const toolCalls: OpenAiToolCall[] = [];
  for (const block of blocks) {
    if (block.type === 'text') text.push(block.text);
    else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input ?? {}),
        },
      });
    }
    // thinking / redacted_thinking blocks are Anthropic-only: dropped.
  }
  return {
    role: 'assistant',
    content: text.length > 0 ? text.join('\n') : null,
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  };
}

function toolResultText(block: Anthropic.ToolResultBlockParam): string {
  const raw = block.content;
  const text =
    typeof raw === 'string'
      ? raw
      : (raw ?? [])
          .map((b) => (b.type === 'text' ? b.text : ''))
          .filter(Boolean)
          .join('\n');
  return block.is_error ? `Error: ${text}` : text;
}

function imageUrl(block: Anthropic.ImageBlockParam): string | null {
  const src = block.source;
  if (src.type === 'base64') return `data:${src.media_type};base64,${src.data}`;
  if (src.type === 'url') return src.url;
  return null;
}

/** OpenAI finish_reason → Anthropic stop_reason. Tool calls always mean `tool_use`. */
export function stopReason(
  finish: string | null | undefined,
  hasToolCalls: boolean,
): Anthropic.StopReason {
  if (hasToolCalls) return 'tool_use';
  if (finish === 'length') return 'max_tokens';
  return 'end_turn';
}

/** Parse tool-call arguments; a model that sends malformed JSON gets `{}` (the tool validates). */
export function parseArguments(args: string): Record<string, unknown> {
  if (!args.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(args);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function toAnthropicUsage(usage: OpenAiUsage | undefined): Anthropic.Usage {
  return {
    input_tokens: usage?.prompt_tokens ?? 0,
    output_tokens: usage?.completion_tokens ?? 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  } as Anthropic.Usage;
}

/** Assemble an Anthropic `Message` from translated parts. */
export function buildMessage(
  id: string,
  model: string,
  text: string,
  toolCalls: Array<{ id: string; name: string; arguments: string }>,
  finish: string | null | undefined,
  usage: OpenAiUsage | undefined,
): Anthropic.Message {
  const content: Anthropic.ContentBlock[] = [];
  if (text)
    content.push({
      type: 'text',
      text,
      citations: null,
    } as Anthropic.TextBlock);
  for (const tc of toolCalls) {
    content.push({
      type: 'tool_use',
      id: tc.id,
      name: tc.name,
      input: parseArguments(tc.arguments),
    } as Anthropic.ToolUseBlock);
  }
  return {
    id,
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: stopReason(finish, toolCalls.length > 0),
    stop_sequence: null,
    usage: toAnthropicUsage(usage),
  } as Anthropic.Message;
}
