import { RagSource } from '../ai/rag-source.type';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required: string[] };
  /**
   * INTERNAL — never sent to Anthropic (the loop forwards only name /
   * description / input_schema). For connector tools: connector-service's
   * `sensitive` flag (every non-read-only tool), which makes the loop hold the
   * call for an in-chat user confirmation instead of executing it
   * (`actions/pending-action-policy.ts`). Built-ins leave it unset.
   */
  sensitive?: boolean;
}

export interface ToolContext {
  conversationId: string;
  userId: string;
  displayName: string;
  /** Owning department id (P6 group bot); scopes KB retrieval when present. */
  departmentId?: string;
  /**
   * The reply-wide, ordered citation list the agentic loop creates — seeded with
   * the KB sources already numbered in the system prompt. Tools that return
   * citable results (KB search, web search) register them through
   * `ai/source-registry` and print the number they get back, so `[Source N]` is
   * always `AI_STREAM_DONE.sources[N-1]`. Optional — absent for code paths that
   * don't run the loop.
   */
  sourceSink?: RagSource[];
  /**
   * Workspace web-search toggle (TASK-12). `false` ⇒ never offer `web_search`,
   * composing with the provider-configured gate. `undefined`/`true` ⇒ env
   * behavior (offered iff a provider is configured).
   */
  webSearchEnabled?: boolean;
  /**
   * Workspace AI connector allow-list (TASK-12), catalog connector ids. When
   * non-null, `mcp__<provider>__*` tools are filtered to providers in this list
   * (`[]` ⇒ no MCP tools). `undefined`/`null` ⇒ no AI-specific filtering.
   */
  allowedConnectors?: string[] | null;
  /**
   * Skill ids currently enabled for this user. Gates action-skill MCP tools:
   * an MCP tool whose provider is in `SKILL_TOOL_REQUIREMENTS` is only exposed
   * when the matching skill id is in this list (Approach A consent layer).
   * `undefined`/`[]` ⇒ no gated-provider tools are offered.
   */
  enabledSkillIds?: string[];
  /**
   * Filled by `ToolRegistryService.getDefinitions`: connector tools (`mcp__<provider>__<tool>`)
   * of connected apps that the member's ROLE may not run, within the AI allow-list. The loop
   * turns them into a system-prompt note so the assistant explains the role limit instead of
   * asking for a reconnect. Optional — absent for code paths that don't need it.
   */
  withheldSink?: string[];
  /**
   * Collects the tools of connected apps that the skill gate drops because the user turned
   * the unlocking skill off; the loop turns them into a system-prompt note so the assistant
   * says the skill is off instead of answering from earlier turns. Optional, like withheldSink.
   */
  skillOffSink?: string[];
}
