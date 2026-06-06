import { registerAs } from '@nestjs/config';

export default registerAs('config', () => ({
  port: parseInt(process.env.PORT ?? '3002', 10),
  mongodbUri: process.env.MONGODB_URI,
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5',
    fallbackModel: process.env.ANTHROPIC_FALLBACK_MODEL ?? 'claude-haiku-4-5-20251001',
  },
  bot: {
    userId: process.env.AI_BOT_USER_ID ?? 'ai-bot-000000000000000000000001',
    displayName: process.env.AI_BOT_DISPLAY_NAME ?? 'PON AI',
  },
  redisChannels: {
    requestChannel: process.env.REDIS_AI_REQUEST_CHANNEL ?? 'ai:request',
    responsePrefix: process.env.REDIS_AI_RESPONSE_PREFIX ?? 'ai:response',
  },
  qdrant: {
    url: process.env.QDRANT_URL ?? 'http://localhost:6333',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  kb: {
    chunkSize: 512,
    chunkOverlap: 80,
    topK: 4,
    embeddingModel: 'text-embedding-3-small',
    qdrantCollection: 'knowledge',
  },
}));
