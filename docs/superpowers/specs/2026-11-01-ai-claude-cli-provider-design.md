# AI provider: Claude via the Claude Code subscription (Agent SDK) — design

Date: 2026-11-01 · Owner decision: default the chat loop to the owner's Claude
subscription, keep the Anthropic API as the fallback. Owner accepted the
account-policy risk (Anthropic's legal page says OAuth credentials are for
Claude Code itself; the owner uses this only for the graduation demo).

## Intent

Every chat question that reaches ai-service is answered by the Claude Code
runtime (the Agent SDK's native CLI) signed in with `CLAUDE_CODE_OAUTH_TOKEN`
(`claude setup-token`), so the demo does not spend API credit. If that path
fails for any reason (rate limit of the plan, auth, timeout, crash) the reply
continues on the Anthropic API exactly as today.

## Goals

- Chat loop (`AiService.handleRequest` → `AgenticLoopService`) runs on the CLI
  when `AI_PROVIDER=claude-cli`. Default stays `api`: nothing changes for CI,
  tests or any deployment that does not set the flag.
- PON's own tools keep working through the CLI: knowledge-base search,
  messages search, reminders, memory, connector (MCP) tools, including the
  confirmation card for sensitive actions. Tool execution stays in ai-service
  (`ToolRoundRunner`), with the same trace, allow-list and skill gates.
- Streaming text to the client as today; usage counted from the SDK result.
- Fallback to the API client without a second answer on screen
  (`StreamInterruptedError` semantics preserved).

## Non-goals

- Utility calls (session titles, compaction, memory facts, digests, call
  summaries, KB vision) stay on the API — cheap haiku calls, not worth the
  process spawn.
- Image turns stay on the API (the CLI prompt is text).
- No change to model routing; the routed Claude model id is passed to the CLI.

## How it is made (builder's calls)

- `@anthropic-ai/claude-agent-sdk` 0.3.316 (+ `zod` 4, peer). It is ESM; the
  service is CommonJS on Node 20, so it is loaded with a real dynamic
  `import()` (`llm/claude-cli.sdk-loader.ts`) and injected into
  `ClaudeCliClient` so unit tests use a fake.
- The SDK runs the native Claude Code binary from its platform package
  (`-linux-arm64-musl` in the alpine image, ~300 MB). `pnpm install --prod`
  in the Dockerfile picks the right optional package; no Dockerfile change.
- One `query()` per reply: `systemPrompt` = PON's system blocks joined,
  `prompt` = the session history rendered as a transcript + the new message,
  `tools: []` (no built-in Claude Code tools), one in-process MCP server
  `pon` exposing PON's offered tools (JSON schema → zod), `allowedTools` =
  those names, `permissionMode: 'default'` (not bypass: the CLI refuses it as root, and the
  container runs as root; with built-in tools off and PON's tools allow-listed
  nothing ever prompts), `settingSources: []`,
  `strictMcpConfig: true`, `persistSession: false`, `maxTurns` = 6 (PON's
  MAX_ITER + 1), abort after `CLAUDE_CLI_TIMEOUT_MS` (default 120 s).
- Subprocess env is built from scratch: `PATH`, `HOME` (`CLAUDE_CLI_HOME`,
  default the process home), `CLAUDE_CODE_OAUTH_TOKEN`, `DISABLE_AUTOUPDATER`.
  `ANTHROPIC_API_KEY` is never passed (the CLI would bill it instead).
- Tool bridge: each MCP tool handler builds a synthetic `tool_use` block and
  calls `ToolRoundRunner.runToolCall` (the existing per-call logic: refuse
  unoffered connector tools, hold sensitive ones as pending actions, execute
  the rest, record the trace, fence output). The text of the tool_result is
  returned to the CLI. PON connector tool names (`mcp__<provider>__<tool>`)
  are exposed to the CLI as `ext__<provider>__<tool>` and mapped back.
- Mirroring: the SDK's assistant (`tool_use`) and user (`tool_result`)
  messages are appended to `LoopState.messages` with PON tool names, so an
  API continuation after a CLI failure never re-runs a tool.
- Errors: result subtype ≠ success, `is_error` with no text, abort, or an SDK
  exception → the loop throws; if text was already streamed it throws
  `StreamInterruptedError` (no fallback), otherwise `runWithFallback`
  continues on the API client.

## Config

| env | default | meaning |
|---|---|---|
| `AI_PROVIDER` | `api` | `claude-cli` turns the CLI path on for the chat loop |
| `CLAUDE_CODE_OAUTH_TOKEN` | — | token from `claude setup-token`; without it the CLI uses the credentials in `HOME/.claude` |
| `CLAUDE_CLI_TIMEOUT_MS` | `120000` | abort a reply after this |
| `CLAUDE_CLI_HOME` | process home | HOME for the CLI subprocess (must be writable) |
| `CLAUDE_CLI_EXECUTABLE` | — | optional `pathToClaudeCodeExecutable` |

## Rollout

dev → release PR → main → Mini pulls `:latest` (CI builds linux/arm64) →
`.env.mini`: `AI_PROVIDER=claude-cli`, `CLAUDE_CODE_OAUTH_TOKEN=…` →
recreate ai-service → smoke: one KB question as Trí, log shows
`Claude CLI reply … cost=0 USD (subscription)` and no API usage.
Rollback: unset `AI_PROVIDER`.
