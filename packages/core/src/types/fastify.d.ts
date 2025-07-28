import type { RateLimiterMemory } from 'rate-limiter-flexible';
import type { AIProviderService } from '../services/ai-provider.js';
import '@fastify/sensible';
import '@fastify/jwt';

// Extend FastifyInstance to include our custom properties
declare module 'fastify' {
  interface FastifyInstance {
    config?: {
      JWT_SECRET: string;
      ALLOWED_ORIGIN: string[];
      SYSTEM_PROMPT?: string;
      RATE_LIMIT_MAX: number;
      RATE_LIMIT_TIME_WINDOW: number;
      TRUST_PROXY: boolean;
      TOKEN_LIMIT_MAX: number;
      TOKEN_LIMIT_TIME_WINDOW: number;
      REQUEST_LIMIT_MAX: number;
      REQUEST_LIMIT_TIME_WINDOW: number;
      EXTERNAL_JWT_ISSUER?: string;
      EXTERNAL_JWT_PUBLIC_KEY?: string;
      EXTERNAL_JWT_SECRET?: string;
      EXTERNAL_JWT_AUDIENCE?: string;
      AI_PROVIDER?: string;
      OPENAI_API_KEY?: string;
      ANTHROPIC_API_KEY?: string;
      AI_MODEL?: string;
      NODE_ENV?: string;
      PORT?: number;
      LOG_LEVEL?: string;
    };
    consumeUserTokens: (userId: string, tokens: number) => Promise<void>;
    getUserUsage: (userId: string) => Promise<import('../plugins/user-rate-limit.js').UsageInfo>;
    checkUserRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    aiProvider: AIProviderService;
  }
  
  interface FastifyRequest {
    userRateLimiters?: {
      request: RateLimiterMemory;
      token: RateLimiterMemory;
    };
  }
  
  interface FastifyReply {
    sse?: (data: { event: string; data: string }) => void;
  }
}