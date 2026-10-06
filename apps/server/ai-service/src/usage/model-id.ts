/**
 * Canonical model id for pricing and per-model aggregation.
 *
 * The price map is keyed by bare ids (`claude-haiku-4-5`), but deployments
 * configure dated snapshots (`ANTHROPIC_FALLBACK_MODEL=claude-haiku-4-5-20251001`)
 * and partner platforms add their own decorations. An exact-match lookup missed
 * those and silently priced them at the default rate. Normalization:
 *  - lower-case, trim
 *  - drop a Bedrock prefix (`anthropic.` / `us.anthropic.`) and `-v1:0` suffix
 *  - drop a trailing 8-digit snapshot date (`-20251001`, Vertex `@20251001`)
 */
export function normalizeModelId(model: string | null | undefined): string {
  let id = (model ?? '').trim().toLowerCase();
  id = id.replace(/^(?:[a-z]{2,6}\.)?anthropic\./, '');
  id = id.replace(/-v\d+(?::\d+)?$/, '');
  id = id.replace(/[-@]\d{8}$/, '');
  return id;
}
