import { registerAs } from '@nestjs/config';

export interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

/** model id → env-var key segment, e.g. `claude-opus-4-8` → `CLAUDE_OPUS_4_8`. */
export function priceEnvKey(model: string): string {
  return model
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Builds the seeded per-model price map for TASK-13. Defaults reflect public
 * list prices (USD / 1M tokens); each entry is overridable via
 * `AI_PRICE_<MODELKEY>_IN` / `_OUT`. Keys are BARE model ids — the cost
 * estimator normalizes dated snapshots (`claude-haiku-4-5-20251001`) to the bare
 * id before the lookup. Unknown models fall back to `defaultInputPerMTok` /
 * `defaultOutputPerMTok` at cost time.
 */
function buildPriceMap(): Record<string, ModelPrice> {
  const seeds: Record<string, ModelPrice> = {
    'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
    'claude-sonnet-4-5': { inputPerMTok: 3, outputPerMTok: 15 },
    'claude-sonnet-4-6': { inputPerMTok: 3, outputPerMTok: 15 },
    'claude-sonnet-5': { inputPerMTok: 2, outputPerMTok: 10 },
    'claude-sonnet-5-5': { inputPerMTok: 2, outputPerMTok: 10 },
    'claude-opus-4-5': { inputPerMTok: 5, outputPerMTok: 25 },
    'claude-opus-4-6': { inputPerMTok: 5, outputPerMTok: 25 },
    'claude-opus-4-7': { inputPerMTok: 5, outputPerMTok: 25 },
    // Was seeded at the Opus 4.1 rate (15/75) — 3x the real Opus 4.8 list price.
    'claude-opus-4-8': { inputPerMTok: 5, outputPerMTok: 25 },
    'claude-opus-5': { inputPerMTok: 5, outputPerMTok: 25 },
    'claude-opus-5-5': { inputPerMTok: 4, outputPerMTok: 20 },
    'claude-fable-5': { inputPerMTok: 10, outputPerMTok: 50 },
    'claude-fable-5-1': { inputPerMTok: 10, outputPerMTok: 50 },
    // OpenRouter light tier default (OPENROUTER_MODEL); other ids use AI_PRICE_* or the default.
    'google/gemini-2.5-flash-lite': { inputPerMTok: 0.1, outputPerMTok: 0.4 },
    'google/gemini-2.5-flash': { inputPerMTok: 0.3, outputPerMTok: 2.5 },
  };
  const map: Record<string, ModelPrice> = {};
  for (const [model, seed] of Object.entries(seeds)) {
    const key = priceEnvKey(model);
    const inEnv = process.env[`AI_PRICE_${key}_IN`];
    const outEnv = process.env[`AI_PRICE_${key}_OUT`];
    map[model] = {
      inputPerMTok: inEnv !== undefined ? parseFloat(inEnv) : seed.inputPerMTok,
      outputPerMTok: outEnv !== undefined ? parseFloat(outEnv) : seed.outputPerMTok,
    };
  }
  return map;
}

export default registerAs('config', () => ({
  port: parseInt(process.env.PORT ?? '3002', 10),
  mongodbUri: process.env.MONGODB_URI,
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
    fallbackModel: process.env.ANTHROPIC_FALLBACK_MODEL ?? 'claude-haiku-4-5',
    // Effort for output_config on the agentic loop (low|medium|high)
    effort: process.env.ANTHROPIC_EFFORT ?? 'high',
    router: {
      // Set ANTHROPIC_ROUTER_ENABLED=false to disable routing and always use complexModel.
      enabled: process.env.ANTHROPIC_ROUTER_ENABLED !== 'false',
      simpleModel: process.env.ANTHROPIC_SIMPLE_MODEL ?? 'claude-haiku-4-5',
      midModel: process.env.ANTHROPIC_MID_MODEL ?? 'claude-sonnet-4-6',
      complexModel: process.env.ANTHROPIC_COMPLEX_MODEL ?? 'claude-opus-4-8',
      simpleMaxChars: parseInt(process.env.ANTHROPIC_ROUTER_SIMPLE_MAX_CHARS ?? '280', 10),
      simpleMaxHistory: parseInt(process.env.ANTHROPIC_ROUTER_SIMPLE_MAX_HISTORY ?? '4', 10),
      midMaxChars: parseInt(process.env.ANTHROPIC_ROUTER_MID_MAX_CHARS ?? '1200', 10),
      midMaxHistory: parseInt(process.env.ANTHROPIC_ROUTER_MID_MAX_HISTORY ?? '20', 10),
    },
  },
  // Light tier (router fast tier + small utility calls) through OpenRouter.
  // Unset OPENROUTER_API_KEY = everything stays on Claude, as before.
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY || undefined,
    model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    // Shown as the app URL on the OpenRouter dashboard (optional).
    appUrl: process.env.OPENROUTER_APP_URL || undefined,
  },
  bot: {
    userId: process.env.AI_BOT_USER_ID ?? 'ai-bot-000000000000000000000001',
    displayName: process.env.AI_BOT_DISPLAY_NAME ?? 'PON AI',
  },
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://platform:platform@localhost:5672',
  redisChannels: {
    requestChannel: process.env.REDIS_AI_REQUEST_CHANNEL ?? 'ai:request',
    responsePrefix: process.env.REDIS_AI_RESPONSE_PREFIX ?? 'ai:response',
  },
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    // Managed Qdrant (Qdrant Cloud) rejects unauthenticated requests, so a
    // cloud URL without this is a 401, not a connection error — which reads
    // like the cluster is down. Unset for a local container, which has no auth.
    apiKey: process.env.QDRANT_API_KEY || undefined,
  },
  voyage: {
    // Embeddings provider (Anthropic's recommended partner). LLM stays Claude;
    // Voyage is ONLY used to vectorize text for RAG + memory + semantic cache.
    apiKey: process.env.VOYAGE_API_KEY,
  },
  kb: {
    chunkSize: 512,
    chunkOverlap: 80,
    // Over-fetch this many candidates, then rerank/keep the best `topK`.
    topK: parseInt(process.env.KB_TOP_K ?? '4', 10),
    overFetch: parseInt(process.env.KB_OVERFETCH ?? '8', 10),
    // Recall floor on cosine score before rerank, NOT a precision gate. Measured
    // with voyage-4-lite on Vietnamese + English docs (2026-10-03): chunks that
    // actually answer the question scored 0.26–0.64 (9 of 12 below 0.5), while
    // off-topic queries scored 0.07–0.43 — the ranges overlap, so no single
    // cosine cut separates them and 0.5 dropped most real answers. Keep the floor
    // low, let BM25/Cohere pick the top-K, and let the prompt's "say you don't
    // have that information" rule handle a weak match.
    scoreThreshold: parseFloat(process.env.KB_SCORE_THRESHOLD ?? '0.2'),
    // voyage-4-lite, not voyage-3.5: the 4-series carries Voyage's 200M free
    // tokens and the older models carry none, so the default decides whether a
    // fresh deployment embeds for free or bills from the first request. Same
    // 1024 dimensions, so embeddingDimensions below is unchanged.
    embeddingModel: process.env.KB_EMBEDDING_MODEL ?? 'voyage-4-lite',
    // Vector size of the embedding model (voyage-4-lite = 1024). Used as the Qdrant
    // collection dimension default. MUST match the model's output.
    embeddingDimensions: parseInt(process.env.KB_EMBEDDING_DIMENSIONS ?? '1024', 10),
    qdrantCollection: process.env.QDRANT_KB_COLLECTION ?? 'knowledge',
    // Hybrid retrieval: fuse vector + in-process BM25 (keyword) via RRF over an
    // enlarged candidate pool before keeping topK. Set false to use vector-only.
    hybridEnabled: process.env.KB_HYBRID_ENABLED !== 'false',
    candidatePool: parseInt(process.env.KB_CANDIDATE_POOL ?? '25', 10),
    // ── TASK-10 Vision / image understanding (KB half) ──────────────────────
    // Master switch for KB vision. OFF ⇒ behavior is exactly as before (image
    // uploads error, sparse/scanned PDFs index whatever sparse text they have).
    visionEnabled: process.env.KB_VISION_ENABLED !== 'false',
    // Whole-document vision transcription for scanned/image-heavy PDFs whose
    // pdf-parse text is sparse. Independent toggle under the master switch.
    visionPdfEnabled: process.env.KB_VISION_PDF_ENABLED !== 'false',
    // Below this many extracted chars a PDF is treated as scanned/image-heavy and
    // routed to vision (when enabled). Conservative so short text PDFs don't trip.
    visionMinTextChars: parseInt(process.env.KB_VISION_MIN_TEXT_CHARS ?? '64', 10),
    // Per-image base64 size cap (~5MB) per the Anthropic vision constraint.
    visionMaxImageBytes: parseInt(process.env.KB_VISION_MAX_IMAGE_BYTES ?? '5000000', 10),
  },
  cohere: {
    // Optional neural reranker. When the key is absent the pipeline gracefully
    // falls back to hybrid (BM25+vector) ordering — no hard dependency.
    apiKey: process.env.COHERE_API_KEY,
    rerankModel: process.env.COHERE_RERANK_MODEL ?? 'rerank-v3.5',
    // Minimum Cohere relevance for a chunk to survive when reranking is active.
    rerankThreshold: parseFloat(process.env.COHERE_RERANK_THRESHOLD ?? '0.3'),
  },
  memory: {
    // Dedicated Qdrant collection holding embedded semantic facts.
    qdrantCollection: process.env.QDRANT_MEMORY_COLLECTION ?? 'ai_memory',
    // How many of the most-relevant facts to inject per request.
    topFacts: parseInt(process.env.MEMORY_TOP_FACTS ?? '6', 10),
    // Cosine similarity above which two facts are treated as duplicates.
    dedupThreshold: parseFloat(process.env.MEMORY_DEDUP_THRESHOLD ?? '0.92'),
    // Extract/refresh facts every N turns.
    extractEveryTurns: parseInt(process.env.MEMORY_EXTRACT_EVERY ?? '10', 10),
    // Recency half-life in days for fact decay scoring.
    halfLifeDays: parseFloat(process.env.MEMORY_HALFLIFE_DAYS ?? '30'),
  },
  aiContext: {
    // Per-user TTL (ms) for the cached role-aware org context read (P2a).
    cacheTtlMs: Number(process.env.AI_CONTEXT_CACHE_TTL_MS ?? 60000),
    // Hard cap (chars) on the injected "About the user & their organization" block.
    blockMaxChars: Number(process.env.AI_CONTEXT_BLOCK_MAX_CHARS ?? 2000),
  },
  ai: {
    // When true, enable adaptive thinking on the primary model.
    enableThinking: process.env.AI_ENABLE_THINKING === 'true',
    // IANA zone the assistant tells the time in, so "8pm tonight" becomes a real
    // datetime for create_reminder. One deployment = one company, so one zone.
    // Also the zone of the daily-digest hour/day window and of reminder times
    // given without an offset (containers run in UTC).
    timeZone: process.env.AI_TIMEZONE ?? 'Asia/Ho_Chi_Minh',
    // Short-term memory (spec A1): how many of the latest session turns are sent
    // verbatim. Older turns only reach the model through the compacted summary.
    historyWindow: parseInt(process.env.AI_HISTORY_WINDOW ?? '20', 10),
    // How many of the latest messages of a shared chat (group / human DM) are
    // shown to the AI as "recent conversation" context when it is @mentioned.
    groupContextMessages: parseInt(process.env.AI_GROUP_CONTEXT_MESSAGES ?? '20', 10),
  },
  cache: {
    // Anthropic prompt caching of the stable persona/tools prefix. On by default
    // (big token savings on multi-turn chats); set false to disable cache_control.
    promptCacheEnabled: process.env.AI_PROMPT_CACHE_ENABLED !== 'false',
    // Short-TTL cache of read-only tool results (Redis), keyed per user+tool+input.
    toolCacheEnabled: process.env.AI_TOOL_CACHE_ENABLED !== 'false',
    toolCacheTtlSec: parseInt(process.env.AI_TOOL_CACHE_TTL ?? '60', 10),
    // Semantic response cache: reuse a recent answer for a near-identical question
    // in the SAME conversation. OFF by default (staleness risk); needs embeddings.
    responseCacheEnabled: process.env.AI_RESPONSE_CACHE_ENABLED === 'true',
    responseCacheThreshold: parseFloat(process.env.AI_RESPONSE_CACHE_THRESHOLD ?? '0.97'),
    responseCacheTtlSec: parseInt(process.env.AI_RESPONSE_CACHE_TTL ?? '600', 10),
    responseCacheMax: parseInt(process.env.AI_RESPONSE_CACHE_MAX ?? '20', 10),
  },
  quota: {
    monthlyTokenLimit: parseInt(process.env.AI_MONTHLY_TOKEN_LIMIT ?? '500000', 10),
  },
  rateLimit: {
    // Per-request rate limiting (fixed 60s window + in-flight concurrency cap),
    // separate from the monthly token quota. Guards against cost spikes / abuse.
    enabled: process.env.AI_RATE_LIMIT_ENABLED !== 'false',
    maxRequestsPerMin: parseInt(process.env.AI_RATE_MAX_REQUESTS_PER_MIN ?? '20', 10),
    maxConcurrent: parseInt(process.env.AI_RATE_MAX_CONCURRENT ?? '3', 10),
  },
  retention: {
    // Daily purge of stale memory facts + orphaned KB chunks. 0 days = never purge.
    enabled: process.env.AI_RETENTION_ENABLED !== 'false',
    memoryTtlDays: parseInt(process.env.AI_MEMORY_TTL_DAYS ?? '180', 10),
    intervalHours: parseInt(process.env.AI_RETENTION_INTERVAL_HOURS ?? '24', 10),
  },
  digest: {
    // Daily-digest cron (TASK-11). These are the env FALLBACKS used when the
    // workspace `aiSettings.dailyDigest*` fields are null (no admin override).
    // OFF by default — a workspace admin must opt in (or set AI_DIGEST_ENABLED).
    enabled: process.env.AI_DIGEST_ENABLED === 'true',
    // Local hour (0–23) to deliver the digest summarizing the prior day.
    hour: parseInt(process.env.AI_DIGEST_HOUR ?? '8', 10),
    // Optional explicit model for the digest summary; null ⇒ resolved via the
    // workspace modelTier → router (fast tier by default).
    model: process.env.AI_DIGEST_MODEL,
  },
  connector: {
    // connector-service internal API base for per-user MCP tools.
    internalUrl: process.env.CONNECTOR_INTERNAL_URL ?? 'http://localhost:3003',
    internalApiKey: process.env.INTERNAL_API_KEY,
    // Tool listing + read-only calls fail fast. Writes (send/create/update…) get
    // longer: aborting a send that the provider is still completing reported a
    // failure for an action that actually happened, inviting a duplicate retry.
    readTimeoutMs: parseInt(process.env.CONNECTOR_READ_TIMEOUT_MS ?? '5000', 10),
    writeTimeoutMs: parseInt(process.env.CONNECTOR_WRITE_TIMEOUT_MS ?? '30000', 10),
  },
  actions: {
    // How long a connector write the AI prepared waits for the requester's
    // in-chat confirmation (`expiresAt`). The Redis record outlives it by a
    // short grace so a late click gets 410 ACTION_EXPIRED instead of 404.
    pendingTtlSec: parseInt(process.env.AI_PENDING_ACTION_TTL_SEC ?? '600', 10),
  },
  chat: {
    // chat-service base used to resolve RELATIVE `/api/uploads/{id}` refs — both
    // AI history image turns (TASK-10 chat vision) and KB fileUrls, which web and
    // mobile send relative. Authless GridFS read. In Docker this MUST be set
    // (compose: http://chat-service:8080) — localhost is the ai-service container.
    internalUrl: process.env.CHAT_INTERNAL_URL ?? 'http://localhost:8080',
    // ── TASK-10 Vision / image understanding (chat half) ────────────────────
    // Master switch for chat image attachments → image content blocks. OFF ⇒
    // image history turns are dropped from the model context (text-only, as
    // before this feature) — text turns are byte-identical regardless.
    visionEnabled: process.env.CHAT_VISION_ENABLED !== 'false',
    // Hard cap on how many images one turn contributes (extras dropped).
    visionMaxImages: parseInt(process.env.CHAT_VISION_MAX_IMAGES ?? '4', 10),
    // Per-image base64 size cap (~5MB) per the Anthropic vision constraint.
    visionMaxImageBytes: parseInt(process.env.CHAT_VISION_MAX_IMAGE_BYTES ?? '5000000', 10),
    // Per-image fetch budget (connect + full body). A stalled upload fetch must
    // not hold the AI request (and its concurrency slot) open indefinitely.
    visionFetchTimeoutMs: parseInt(process.env.CHAT_VISION_FETCH_TIMEOUT_MS ?? '10000', 10),
  },
  pricing: {
    // Per-model token price map for the usage/cost dashboard (TASK-13). Values
    // are USD per 1M tokens. Ops/billing constants (NOT Workspace.aiSettings) —
    // they change rarely and are deployment-owned. Override per model via env:
    //   AI_PRICE_<MODELKEY>_IN / AI_PRICE_<MODELKEY>_OUT  (USD / 1M tokens)
    // where <MODELKEY> is the model id upper-cased with non-alphanumerics → '_'
    //   e.g. claude-opus-4-8 → AI_PRICE_CLAUDE_OPUS_4_8_IN / _OUT
    // A model seen in messages.trace but absent from the map falls back to the
    // default prices below (cost is never silently dropped).
    defaultInputPerMTok: parseFloat(process.env.AI_PRICE_DEFAULT_IN ?? '3'),
    defaultOutputPerMTok: parseFloat(process.env.AI_PRICE_DEFAULT_OUT ?? '15'),
    // Seeded list prices for the current Claude models (see buildPriceMap). Each
    // is still overridable by its AI_PRICE_<MODELKEY>_IN/_OUT env var. Prompt
    // cache writes/reads are priced at 1.25x / 0.1x the input price.
    models: buildPriceMap(),
  },
  webSearch: {
    // Built-in `web_search` tool. ON by default (per-workspace toggle); set
    // WEB_SEARCH_ENABLED=false to never register the tool. Even when enabled, the
    // tool only registers if the SELECTED provider reports itself configured
    // (graceful degradation — no provider/key ⇒ tool simply not offered).
    enabled: process.env.WEB_SEARCH_ENABLED !== 'false',
    // 'generic' = generic search API (Brave/Tavily-style) via WEB_SEARCH_API_URL
    //             + WEB_SEARCH_API_KEY. 'anthropic' = Anthropic server-side web
    //             search (currently a documented no-op stub — see provider file).
    provider: process.env.WEB_SEARCH_PROVIDER ?? 'generic',
    apiKey: process.env.WEB_SEARCH_API_KEY,
    apiUrl: process.env.WEB_SEARCH_API_URL,
    maxResults: parseInt(process.env.WEB_SEARCH_MAX_RESULTS ?? '5', 10),
  },
}));
