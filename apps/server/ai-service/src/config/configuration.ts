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
}));
