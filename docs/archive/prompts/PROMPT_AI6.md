Read these files for full context before writing any code:
- CLAUDE.md
- .claude/rules/ai-service.md
- docs/decisions.md        (ADR-007, ADR-008)
- TODO.md                  (section "SPRINT AI-6" only — stop at SPRINT AI-5)

Sprints AI-1 through AI-5 are 100% DONE. This is the FINAL sprint of Phase 2.
Starting Sprint AI-6: Multi-workspace & Persona.

Current ai-service state (apps/server/ai-service/src/):
- ai/ai.service.ts — agentic loop + streaming + memory + RAG + trace all working
- System prompt currently hardcoded: "You are PON AI, an intelligent assistant..."
  → AI-6.1 replaces this with PersonaService.buildSystemPrompt()
- usage/ — UsageService (recordUsage, getMonthlyUsage) complete from AI-5.2
  → AI-6.2 adds isQuotaExceeded() to this existing service

Implement ALL tasks in order: AI-6.1 → AI-6.2 → AI-6.3 → AI-6.4 → AI-6.5 → AI-6.6 → AI-6.7

Key constraints:
- "Workspace" = AI persona config scoped per conversation (no full multi-tenancy rewrite needed)
- Persona collection name: "ai_personas" (written by chat-service, read by ai-service — shared MongoDB)
- Quota check is the FIRST thing in handleRequest() — if exceeded, publish AI_STREAM_ERROR immediately and return, no Anthropic call made
- Default quota: 500000 tokens/month per user (env AI_MONTHLY_TOKEN_LIMIT)
- Monthly usage query: sum inputTokens+outputTokens where date LIKE 'YYYY-MM%' for current month
- Persona PUT endpoint: only group admins (conversation.adminIds contains userId); DMs reject with 403
- Tone enum exactly: 'friendly' | 'professional' | 'concise' | 'creative'
- systemPromptPrefix max 500 chars — validate in both chat-service (DTO validation) and ai-service (truncate if somehow exceeds)
- Flutter: persona config screen only shown in GroupInfoScreen for group admins — hide for regular members and DMs
- All new UI strings → all 7 ARB files (en/vi/zh/ja/ko/es/fr) + flutter gen-l10n
- Flutter file limits: UI ≤ 400 lines, providers ≤ 500 lines

After ALL tasks done — Phase 2 completion:
- Run mvn test (chat-service) → must pass
- Run pnpm test (ai-service) → must pass
- Run flutter analyze && flutter test → must pass
- Update docs/roadmap.md: Phase 2 → ✅ DONE
- Update CLAUDE.md: reflect Phase 2 complete
- Append results to QA LOG in TODO.md and mark ALL Sprint AI-6 tasks DONE
