/**
 * DEV-ONLY test mode: run ai-service chat on Google Gemini's OpenAI-compatible
 * endpoint, through the client OpenRouter already uses, so the AI flows can be
 * tested without Claude credit. GEMINI_API_KEY set = every chat tier runs on
 * Gemini; empty = Claude, exactly as before. No Claude code path changes.
 * Stays on `dev` — never ship it to main (.claude/rules/dev-local-only.md).
 */

/** Marks a Gemini model id; it contains '/' so routing hands it to the OpenAI-compatible client. */
export const GEMINI_MODEL_PREFIX = 'gemini/';

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

/**
 * Free-tier Flash-Lite: Gemini 2.5 is closed to new API keys, and gemini-3.5-flash
 * allows only 20 requests a day per model — a few chat turns, since each turn
 * makes several calls. Quotas are per model, so GEMINI_MODEL can switch when one runs out.
 */
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

/** The model id every router tier uses in Gemini test mode; undefined when the mode is off. */
export function geminiTierModel(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (!env.GEMINI_API_KEY) return undefined;
  return GEMINI_MODEL_PREFIX + (env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL);
}

/**
 * Schema keywords Gemini function declarations accept (an OpenAPI 3.0 subset).
 * Anything else (`$schema`, `additionalProperties`, `exclusiveMinimum`, …) is
 * rejected with a 400 "Unknown name", and MCP tool schemas carry plenty of them.
 */
const KEPT_KEYWORDS = new Set([
  'type',
  'format',
  'description',
  'title',
  'nullable',
  'enum',
  'items',
  'properties',
  'required',
  'anyOf',
  'minItems',
  'maxItems',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'pattern',
]);
const GEMINI_STRING_FORMATS = new Set(['date-time', 'enum']);

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A JSON schema cut down to what Gemini accepts; the meaning is kept where Gemini can express it. */
export function geminiSchema(schema: unknown): unknown {
  if (!isObject(schema)) return schema;
  const src: Json = { ...schema };
  if (src.oneOf && !src.anyOf) src.anyOf = src.oneOf;
  if (typeof src.const === 'string' && !src.enum) src.enum = [src.const];

  const out: Json = {};
  for (const [key, value] of Object.entries(src)) {
    if (!KEPT_KEYWORDS.has(key)) continue;
    if (key === 'properties' && isObject(value)) {
      const props = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, geminiSchema(v)]));
      if (Object.keys(props).length > 0) out.properties = props;
    } else if (key === 'items') {
      out.items = geminiSchema(Array.isArray(value) ? value[0] : value);
    } else if (key === 'anyOf' && Array.isArray(value)) {
      out.anyOf = value.map(geminiSchema);
    } else if (key === 'type' && Array.isArray(value)) {
      // ["string", "null"] → type string + nullable; Gemini takes one type.
      const types = value.filter((t): t is string => typeof t === 'string');
      out.type = types.find((t) => t !== 'null') ?? 'string';
      if (types.includes('null')) out.nullable = true;
    } else if (key === 'format') {
      if (typeof value === 'string' && GEMINI_STRING_FORMATS.has(value)) out.format = value;
    } else if (key === 'enum') {
      if (Array.isArray(value) && value.every((v) => typeof v === 'string')) out.enum = value;
    } else {
      out[key] = value;
    }
  }
  if (Array.isArray(out.required)) {
    const props = isObject(out.properties) ? out.properties : {};
    const required = out.required.filter((r): r is string => typeof r === 'string' && r in props);
    if (required.length > 0) out.required = required;
    else delete out.required;
  }
  return out;
}

/**
 * Accepted by Gemini in place of a tool call's thought signature when the real
 * one is gone (a restart mid-loop, or a call the Claude fallback made).
 */
const PLACEHOLDER_SIGNATURE = { google: { thought_signature: 'skip_thought_signature_validator' } };
const MAX_SIGNATURES = 500;

/**
 * Gemini 3 returns a thought signature on each tool call (`extra_content`) and
 * answers 400 when that call is replayed without it. ai-service history only
 * keeps Anthropic `tool_use` blocks, so the signatures are held here by tool
 * call id and put back on the next request.
 */
export class GeminiThoughtSignatures {
  private readonly byToolCallId = new Map<string, unknown>();

  readonly remember = (toolUseId: string, extra: unknown): void => {
    if (this.byToolCallId.size >= MAX_SIGNATURES) {
      const oldest = this.byToolCallId.keys().next().value;
      if (oldest !== undefined) this.byToolCallId.delete(oldest);
    }
    this.byToolCallId.set(toolUseId, extra);
  };

  /** Each assistant tool call gets its own signature back, or the placeholder. */
  readonly attach = (body: Json): Json => {
    if (!Array.isArray(body.messages)) return body;
    const messages = body.messages.map((m: unknown) => {
      if (!isObject(m) || m.role !== 'assistant' || !Array.isArray(m.tool_calls)) return m;
      const toolCalls = m.tool_calls.map((tc: unknown) =>
        isObject(tc)
          ? { ...tc, extra_content: this.byToolCallId.get(String(tc.id)) ?? PLACEHOLDER_SIGNATURE }
          : tc,
      );
      return { ...m, tool_calls: toolCalls };
    });
    return { ...body, messages };
  };
}

/**
 * Gemini 3 thinks before its first token and cannot turn that off; at its default
 * depth a turn with many tools can pass the client's 20 s first-token timeout.
 */
const GEMINI_REASONING_EFFORT = 'low';

/** Request body for Gemini: bare model id, tool schemas cut to what Gemini accepts. */
export function toGeminiBody(body: Json): Json {
  const out: Json = { reasoning_effort: GEMINI_REASONING_EFFORT, ...body };
  if (typeof out.model === 'string' && out.model.startsWith(GEMINI_MODEL_PREFIX)) {
    out.model = out.model.slice(GEMINI_MODEL_PREFIX.length);
  }
  if (Array.isArray(out.tools)) {
    out.tools = out.tools.map((tool: unknown) => {
      if (!isObject(tool) || !isObject(tool.function)) return tool;
      const { parameters, ...fn } = tool.function;
      const schema = geminiSchema(parameters);
      // Gemini rejects an OBJECT with no properties; a tool without arguments sends none.
      const hasArgs = isObject(schema) && isObject(schema.properties);
      return { ...tool, function: hasArgs ? { ...fn, parameters: schema } : fn };
    });
  }
  return out;
}
