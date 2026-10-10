/**
 * Reads the eval judge's `{"pass": bool, "reason": string}` verdict. Kept under
 * src/ so it is unit tested (jest rootDir is src); eval/run-eval.ts imports it.
 *
 * The judge is asked for bare JSON, but it sometimes wraps it in a fence, puts
 * unescaped quotes in the reason, or is cut off mid-reason. Each of those used
 * to count as a failed *answer* ("Judge JSON parse failed") and tipped the CI
 * gate. Here the verdict survives them; null only when there is no verdict.
 */
export interface JudgeVerdict {
  pass: boolean;
  reason: string;
}

export function parseJudgeVerdict(raw: string): JudgeVerdict | null {
  const text = raw.trim();
  const json = text.match(/\{[\s\S]*\}/);
  if (json) {
    try {
      const parsed: unknown = JSON.parse(json[0]);
      if (typeof parsed === "object" && parsed !== null) {
        const p = parsed as Record<string, unknown>;
        if (typeof p.pass === "boolean") {
          return {
            pass: p.pass,
            reason: typeof p.reason === "string" ? p.reason : "",
          };
        }
      }
    } catch {
      // Not valid JSON: fall back to reading the fields directly.
    }
  }
  const pass = text.match(/"pass"\s*:\s*(true|false)/);
  if (!pass) return null;
  const reason = text.match(/"reason"\s*:\s*"([\s\S]*)/);
  return {
    pass: pass[1] === "true",
    reason: reason
      ? reason[1].replace(/\s*\}?\s*(?:```)?\s*$/, "").replace(/"$/, "")
      : "",
  };
}
