import { registerAs } from '@nestjs/config';

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
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  kb: {
    chunkSize: 512,
    chunkOverlap: 80,
    // Over-fetch this many candidates, then rerank/keep the best `topK`.
    topK: parseInt(process.env.KB_TOP_K ?? '4', 10),
    overFetch: parseInt(process.env.KB_OVERFETCH ?? '8', 10),
    // Minimum cosine score for a chunk to be considered grounded context.
    scoreThreshold: parseFloat(process.env.KB_SCORE_THRESHOLD ?? '0.5'),
    embeddingModel: 'text-embedding-3-small',
    qdrantCollection: process.env.QDRANT_KB_COLLECTION ?? 'knowledge',
    // Hybrid retrieval: fuse vector + in-process BM25 (keyword) via RRF over an
    // enlarged candidate pool before keeping topK. Set false to use vector-only.
    hybridEnabled: process.env.KB_HYBRID_ENABLED !== 'false',
    candidatePool: parseInt(process.env.KB_CANDIDATE_POOL ?? '25', 10),
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
    extractEveryTurns: parseInt(process.env.MEMORY_EXTRACT_EVERY ?? '20', 10),
    // Recency half-life in days for fact decay scoring.
    halfLifeDays: parseFloat(process.env.MEMORY_HALFLIFE_DAYS ?? '30'),
  },
  ai: {
    // When true, enable adaptive thinking on the primary model.
    enableThinking: process.env.AI_ENABLE_THINKING === 'true',
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
  connector: {
    // connector-service internal API base for per-user MCP tools.
    internalUrl: process.env.CONNECTOR_INTERNAL_URL ?? 'http://localhost:3003',
    internalApiKey: process.env.INTERNAL_API_KEY,
  },
}));
