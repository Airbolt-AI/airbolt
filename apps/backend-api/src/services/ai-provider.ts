import fp from 'fastify-plugin';
import { generateText, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import {
  PROVIDER_CONFIG,
  type ProviderName,
  type ProviderFeature,
  getProviderConfig,
  getDefaultModel,
  getProviderFeatures,
  UnknownProviderError,
} from './provider-config.js';

// Message schemas matching AI provider types
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

export type Message = z.infer<typeof MessageSchema>;

// Response schema
export const ChatResponseSchema = z.object({
  content: z.string(),
  usage: z
    .object({
      total_tokens: z.number(),
    })
    .optional(),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// Provider configuration schema
export const ProviderConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic']).default('openai'),
  model: z.string().optional(),
  apiKey: z.string(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export { PROVIDER_FEATURES } from './provider-config.js';

// Provider factory registry
const PROVIDER_FACTORIES = {
  openai: (apiKey: string, model: string) => {
    const provider = createOpenAI({ apiKey });
    return provider.chat(model);
  },
  anthropic: (apiKey: string, model: string) => {
    const provider = createAnthropic({ apiKey });
    return provider.messages(model);
  },
} as const;

// Error class for AI provider errors
export class AIProviderError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class AIProviderService {
  private model: LanguageModel;
  private systemPrompt?: string;
  private maxRetries: number = 3;
  private baseDelay: number = 1000;
  private provider: string;
  private apiKeys: Partial<Record<ProviderName, string>> = {};

  static createFromEnv(config: {
    AI_PROVIDER?: string;
    OPENAI_API_KEY?: string | undefined;
    ANTHROPIC_API_KEY?: string | undefined;
    AI_MODEL?: string | undefined;
    SYSTEM_PROMPT?: string | undefined;
    NODE_ENV?: string;
  }): AIProviderService {
    const provider = (config.AI_PROVIDER || 'openai') as 'openai' | 'anthropic';

    // Get API key from config based on provider
    const providerConfig = getProviderConfig(provider);
    if (!providerConfig) {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    const envKey = providerConfig.envKey as keyof typeof config;
    const apiKey =
      envKey === 'OPENAI_API_KEY'
        ? config.OPENAI_API_KEY
        : envKey === 'ANTHROPIC_API_KEY'
          ? config.ANTHROPIC_API_KEY
          : undefined;

    if (!apiKey) {
      throw new Error(`${provider.toUpperCase()}_API_KEY is not configured`);
    }

    // Store all available API keys for dynamic provider switching
    const apiKeys: Partial<Record<ProviderName, string>> = {};

    // Collect all available API keys from config
    for (const [name, providerConf] of Object.entries(PROVIDER_CONFIG)) {
      const envKey = providerConf.envKey as keyof typeof config;
      const key =
        envKey === 'OPENAI_API_KEY'
          ? config.OPENAI_API_KEY
          : envKey === 'ANTHROPIC_API_KEY'
            ? config.ANTHROPIC_API_KEY
            : undefined;
      if (key) {
        apiKeys[name as ProviderName] = key;
      }
    }

    return new AIProviderService(
      {
        provider,
        apiKey,
        model: config.AI_MODEL,
      },
      config.SYSTEM_PROMPT,
      {
        apiKeys,
        // eslint-disable-next-line runtime-safety/prefer-environment-utils
        isProduction: config.NODE_ENV === 'production',
      }
    );
  }

  constructor(
    config: ProviderConfig,
    systemPrompt?: string,
    options?: {
      maxRetries?: number;
      baseDelay?: number;
      apiKeys?: Partial<Record<ProviderName, string>>;
      isProduction?: boolean;
    }
  ) {
    this.provider = config.provider;

    // Get model name from config or use default
    let modelName: string;
    try {
      modelName = config.model || getDefaultModel(config.provider);
    } catch (error) {
      if (error instanceof UnknownProviderError && options?.isProduction) {
        console.warn(
          `[AI Provider] Unknown provider "${error.provider}", using fallback model "${error.suggestedFallback}"`
        );
        modelName = error.suggestedFallback;
      } else {
        throw error;
      }
    }

    // Initialize the appropriate provider using the factory
    const factory = PROVIDER_FACTORIES[config.provider];
    if (!factory) {
      throw new Error(`Unsupported provider: ${config.provider}`);
    }
    this.model = factory(config.apiKey, modelName);

    if (systemPrompt !== undefined) {
      this.systemPrompt = systemPrompt;
    }

    if (options?.maxRetries !== undefined) {
      this.maxRetries = options.maxRetries;
    }
    if (options?.baseDelay !== undefined) {
      this.baseDelay = options.baseDelay;
    }
    if (options?.apiKeys !== undefined) {
      this.apiKeys = options.apiKeys;
    }
  }

  private createModel(
    provider: string,
    model: string,
    apiKey: string
  ): LanguageModel {
    const factory =
      PROVIDER_FACTORIES[provider as keyof typeof PROVIDER_FACTORIES];
    if (!factory) {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    return factory(apiKey, model);
  }

  async createChatCompletion(
    messages: Message[],
    systemPromptOverride?: string,
    providerOverride?: string,
    modelOverride?: string
  ): Promise<ChatResponse> {
    const messagesWithSystem = this.injectSystemPrompt(
      messages,
      systemPromptOverride
    );

    // Determine which model to use
    let modelToUse = this.model;
    let providerForError = this.provider;

    if (providerOverride || modelOverride) {
      // Use the override provider or fall back to current provider
      const provider = providerOverride || this.provider;

      // Validate provider first
      if (!PROVIDER_FACTORIES[provider as keyof typeof PROVIDER_FACTORIES]) {
        throw new AIProviderError(
          `Unsupported provider: ${provider}`,
          400,
          'INVALID_PROVIDER'
        );
      }

      const defaultModel = getDefaultModel(provider);
      const modelName = modelOverride || defaultModel;

      // Get the appropriate API key from stored keys
      const apiKey = this.apiKeys[provider as ProviderName];

      if (!apiKey) {
        throw new AIProviderError(
          `API key not configured for provider: ${provider}`,
          400,
          'MISSING_API_KEY'
        );
      }

      modelToUse = this.createModel(provider, modelName, apiKey);
      providerForError = provider;
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Convert messages to Vercel AI SDK format
        const formattedMessages = messagesWithSystem.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

        // Use Vercel AI SDK's generateText function
        const result = await generateText({
          model: modelToUse,
          messages: formattedMessages,
          temperature: 0.7,
          maxTokens: 1000,
        });

        return {
          content: result.text,
          usage: result.usage
            ? {
                total_tokens: result.usage.totalTokens,
              }
            : undefined,
        };
      } catch (error) {
        lastError = error;

        // Check if it's a retryable error
        if (this.shouldRetry(error) && attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }

        // Non-retryable error, break the loop
        break;
      }
    }

    // Handle the error
    this.handleProviderError(lastError, providerForError);
  }

  private injectSystemPrompt(
    messages: Message[],
    systemPromptOverride?: string
  ): Message[] {
    const promptToUse = systemPromptOverride ?? this.systemPrompt;

    if (!promptToUse || promptToUse.trim() === '') {
      return messages;
    }

    // Check if first message is already a system message
    if (messages.length > 0 && messages[0]?.role === 'system') {
      // Replace it with our system prompt
      return [{ role: 'system', content: promptToUse }, ...messages.slice(1)];
    }

    // Otherwise, prepend the system prompt
    return [{ role: 'system', content: promptToUse }, ...messages];
  }

  private shouldRetry(error: unknown): boolean {
    // Vercel AI SDK errors typically have a status property
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      // Retry on rate limits and server errors
      return status === 429 || status >= 500;
    }
    return false;
  }

  private handleProviderError(
    error: unknown,
    providerForError: string = this.provider
  ): never {
    const provider = providerForError;
    // Handle Vercel AI SDK errors
    if (error && typeof error === 'object' && 'status' in error) {
      const aiError = error as {
        status: number;
        message?: string;
        error?: string;
      };
      const errorMessage = aiError.message || aiError.error || 'Unknown error';

      switch (aiError.status) {
        case 401:
          throw new AIProviderError(
            `Invalid ${providerForError.toUpperCase()} API key`,
            401,
            'INVALID_API_KEY'
          );
        case 429:
          if (
            errorMessage.includes('quota') ||
            errorMessage.includes('billing')
          ) {
            throw new AIProviderError(
              `${provider.toUpperCase()} quota exceeded. Please check your account billing.`,
              402,
              'INSUFFICIENT_QUOTA'
            );
          }
          throw new AIProviderError(
            'Rate limit exceeded. Please try again later.',
            429,
            'RATE_LIMIT_EXCEEDED'
          );
        case 400:
          throw new AIProviderError(
            `Invalid request to ${provider.toUpperCase()} API`,
            400,
            'INVALID_REQUEST'
          );
        case 500:
        case 502:
        case 503:
          throw new AIProviderError(
            `${provider.toUpperCase()} service temporarily unavailable`,
            503,
            'SERVICE_UNAVAILABLE'
          );
        default:
          throw new AIProviderError(
            `${provider.toUpperCase()} API error: ${errorMessage}`,
            aiError.status || 500,
            'PROVIDER_ERROR'
          );
      }
    }

    if (error instanceof Error) {
      // Network errors or other unexpected errors
      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ETIMEDOUT')
      ) {
        throw new AIProviderError(
          `Unable to connect to ${provider.toUpperCase()} API`,
          503,
          'CONNECTION_ERROR'
        );
      }

      throw new AIProviderError(
        `Unexpected error communicating with ${provider.toUpperCase()}`,
        500,
        'UNEXPECTED_ERROR'
      );
    }

    throw new AIProviderError('Unknown error occurred', 500, 'UNKNOWN_ERROR');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  supportsFeature(feature: ProviderFeature): boolean {
    const features = getProviderFeatures(this.provider);
    if (!features) return false;

    // Explicit property checks to avoid object injection
    switch (feature) {
      case 'streaming':
        return features.streaming;
      case 'functionCalling':
        return features.functionCalling;
      case 'vision':
        return features.vision;
      default:
        return false;
    }
  }
}

// Fastify plugin to register the service
declare module 'fastify' {
  interface FastifyInstance {
    aiProvider: AIProviderService;
  }
}

export default fp(
  fastify => {
    const config = fastify.config;

    if (!config) {
      throw new Error('Configuration not loaded');
    }

    const service = AIProviderService.createFromEnv(config);

    fastify.decorate('aiProvider', service);

    fastify.log.info(
      `AI Provider service registered successfully (provider: ${config.AI_PROVIDER || 'openai'})`
    );
  },
  {
    name: 'ai-provider-service',
    dependencies: ['env-plugin'],
  }
);
