/**
 * LLM-as-Judge Eval Harness — PON AI Service
 *
 * Runs a fixed dataset of prompts through the system-under-test model,
 * then grades each response with a lightweight judge model (Haiku).
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... pnpm --filter ai-service eval
 *
 * Does NOT require the full NestJS stack, RabbitMQ, Redis, or Qdrant.
 */

import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { evaluateGate } from '../src/eval/eval-gate';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvalCase {
  id: string;
  category: string;
  prompt: string;
  context: string;
  rubric: string;
}

interface JudgeResult {
  pass: boolean;
  reason: string;
}

type CaseResult =
  | { status: 'pass' | 'fail'; id: string; category: string; answer: string; reason: string }
  | { status: 'error'; id: string; category: string; error: string };

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUT_MODEL = process.env.EVAL_SUT_MODEL ?? 'claude-opus-4-8';
const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL ?? 'claude-haiku-4-5';
const DATASET_PATH = path.join(__dirname, 'dataset.jsonl');

// CI gate: when EVAL_MIN_PASS_RATE is set (0..1), exit non-zero if the pass rate
// falls below it. Unset = report-only (always exit 0), preserving local usage.
const RAW_MIN_PASS_RATE = process.env.EVAL_MIN_PASS_RATE;
const GATE_ENABLED = RAW_MIN_PASS_RATE !== undefined && RAW_MIN_PASS_RATE !== '';
const MIN_PASS_RATE = GATE_ENABLED ? Number(RAW_MIN_PASS_RATE) : 0;

const SYSTEM_PERSONA = `You are PON AI, an intelligent assistant embedded in the PON chat platform.
Be helpful, concise, and friendly. Respond in the same language the user writes in.
If you don't know something, say so clearly.
Never reveal another user's private data. Maintain your assistant identity at all times.`;

// ---------------------------------------------------------------------------
// Dataset loading
// ---------------------------------------------------------------------------

function loadDataset(): EvalCase[] {
  const raw = fs.readFileSync(DATASET_PATH, 'utf8');
  const lines = raw.trim().split('\n').filter((l) => l.trim().length > 0);

  return lines.map((line, idx) => {
    const parsed: unknown = JSON.parse(line);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>)['id'] !== 'string' ||
      typeof (parsed as Record<string, unknown>)['category'] !== 'string' ||
      typeof (parsed as Record<string, unknown>)['prompt'] !== 'string' ||
      typeof (parsed as Record<string, unknown>)['rubric'] !== 'string'
    ) {
      throw new Error(`Invalid eval case at line ${idx + 1}: missing required fields`);
    }
    const p = parsed as Record<string, unknown>;
    return {
      id: p['id'] as string,
      category: p['category'] as string,
      prompt: p['prompt'] as string,
      context: typeof p['context'] === 'string' ? p['context'] : '',
      rubric: p['rubric'] as string,
    };
  });
}

// ---------------------------------------------------------------------------
// System-under-test call
// ---------------------------------------------------------------------------

async function callSut(client: Anthropic, evalCase: EvalCase): Promise<string> {
  let systemPrompt = SYSTEM_PERSONA;

  if (evalCase.context.trim().length > 0) {
    systemPrompt +=
      `\n\n## Grounding Context (use this as your knowledge source):\n${evalCase.context}`;
  }

  const response = await client.messages.create({
    model: SUT_MODEL,
    max_tokens: 1024,
    temperature: 0, // deterministic SUT output for a stable CI gate
    system: systemPrompt,
    messages: [{ role: 'user', content: evalCase.prompt }],
  });

  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  );
  return textBlocks.map((b) => b.text).join('').trim();
}

// ---------------------------------------------------------------------------
// Judge call
// ---------------------------------------------------------------------------

const JUDGE_SYSTEM = `You are a strict grader evaluating an AI assistant's response.
You will be given a rubric, the user's prompt, optional grounding context, and the assistant's answer.
Grade whether the answer satisfies ALL rubric criteria.
Respond with ONLY a valid JSON object — no markdown, no extra text.
Format: {"pass": true|false, "reason": "concise explanation under 120 chars"}`;

async function callJudge(
  client: Anthropic,
  evalCase: EvalCase,
  answer: string,
): Promise<JudgeResult> {
  const userMessage =
    `RUBRIC:\n${evalCase.rubric}\n\n` +
    `USER PROMPT:\n${evalCase.prompt}\n\n` +
    (evalCase.context.trim() ? `GROUNDING CONTEXT:\n${evalCase.context}\n\n` : '') +
    `ASSISTANT ANSWER:\n${answer}`;

  // Haiku does NOT support adaptive thinking or effort param — plain call only.
  const response = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 256,
    temperature: 0, // deterministic judgments
    system: JUDGE_SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  // Robust JSON extraction — handles models that add markdown despite instructions.
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { pass: false, reason: `Judge produced non-JSON response: ${raw.slice(0, 80)}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return { pass: false, reason: `Judge JSON parse failed: ${raw.slice(0, 80)}` };
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)['pass'] !== 'boolean' ||
    typeof (parsed as Record<string, unknown>)['reason'] !== 'string'
  ) {
    return { pass: false, reason: `Judge returned unexpected shape: ${raw.slice(0, 80)}` };
  }

  const p = parsed as Record<string, unknown>;
  return {
    pass: p['pass'] as boolean,
    reason: p['reason'] as string,
  };
}

// ---------------------------------------------------------------------------
// Results table
// ---------------------------------------------------------------------------

const COL_ID = 18;
const COL_CAT = 22;
const COL_STATUS = 8;
const COL_REASON = 70;

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n - 1) + '…' : s.padEnd(n);
}

function printHeader(): void {
  console.log(
    pad('ID', COL_ID) +
    pad('CATEGORY', COL_CAT) +
    pad('STATUS', COL_STATUS) +
    'REASON',
  );
  console.log('─'.repeat(COL_ID + COL_CAT + COL_STATUS + COL_REASON));
}

function printRow(r: CaseResult): void {
  if (r.status === 'error') {
    console.log(
      pad(r.id, COL_ID) +
      pad(r.category, COL_CAT) +
      pad('ERROR', COL_STATUS) +
      r.error.slice(0, COL_REASON - 1),
    );
    return;
  }
  const statusLabel = r.status === 'pass' ? 'PASS' : 'FAIL';
  console.log(
    pad(r.id, COL_ID) +
    pad(r.category, COL_CAT) +
    pad(statusLabel, COL_STATUS) +
    r.reason.slice(0, COL_REASON - 1),
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    if (GATE_ENABLED) {
      // CI gate without a key (e.g. fork PRs that can't read secrets): skip
      // rather than hard-fail the pipeline.
      console.warn('SKIP: ANTHROPIC_API_KEY not set — eval gate skipped (exit 0).');
      process.exit(0);
    }
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set.');
    process.exit(1);
  }
  if (GATE_ENABLED && (Number.isNaN(MIN_PASS_RATE) || MIN_PASS_RATE < 0 || MIN_PASS_RATE > 1)) {
    console.error(`ERROR: EVAL_MIN_PASS_RATE must be between 0 and 1 (got "${RAW_MIN_PASS_RATE}").`);
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  let dataset: EvalCase[];
  try {
    dataset = loadDataset();
  } catch (err) {
    console.error('Failed to load dataset:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  console.log(`\nPON AI Eval Harness`);
  console.log(`SUT model   : ${SUT_MODEL}`);
  console.log(`Judge model : ${JUDGE_MODEL}`);
  console.log(`Cases       : ${dataset.length}`);
  console.log(`Dataset     : ${DATASET_PATH}\n`);

  printHeader();

  const results: CaseResult[] = [];

  for (const evalCase of dataset) {
    let caseResult: CaseResult;

    // Stage 1: Call SUT
    let answer: string;
    try {
      answer = await callSut(client, evalCase);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      caseResult = {
        status: 'error',
        id: evalCase.id,
        category: evalCase.category,
        error: `SUT call failed: ${errorMsg}`,
      };
      results.push(caseResult);
      printRow(caseResult);
      continue;
    }

    // Stage 2: Call Judge
    try {
      const judgment = await callJudge(client, evalCase, answer);
      caseResult = {
        status: judgment.pass ? 'pass' : 'fail',
        id: evalCase.id,
        category: evalCase.category,
        answer,
        reason: judgment.reason,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      caseResult = {
        status: 'error',
        id: evalCase.id,
        category: evalCase.category,
        error: `Judge call failed: ${errorMsg}`,
      };
    }

    results.push(caseResult);
    printRow(caseResult);
  }

  // Summary
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const errored = results.filter((r) => r.status === 'error').length;
  const total = results.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  console.log('\n' + '═'.repeat(COL_ID + COL_CAT + COL_STATUS + COL_REASON));
  console.log(`RESULT: ${passed}/${total} passed (${passRate}%)  |  ${failed} failed  |  ${errored} errors`);

  if (!GATE_ENABLED) {
    console.log('(report-only — set EVAL_MIN_PASS_RATE to enable the CI gate)\n');
    process.exit(0);
  }

  const decision = evaluateGate({ passed, errored, total, minPassRate: MIN_PASS_RATE });
  console.log(`GATE: ${decision.ok ? 'PASS' : 'FAIL'} — ${decision.reason}\n`);
  process.exit(decision.ok ? 0 : 1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Unexpected fatal error:', err);
    process.exit(1);
  });
}
