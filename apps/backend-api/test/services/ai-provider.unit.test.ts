import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AIProviderService,
  AIProviderError,
  PROVIDER_FEATURES,
} from '@airbolt/core/services/ai-provider.js';
import { UnknownProviderError } from '@airbolt/core/services/provider-config.js';
import { generateText } from 'ai';

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => ({
    chat: vi.fn(() => 'mock-openai-model'),
  })),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => ({
    messages: vi.fn(() => 'mock-anthropic-model'),
  })),
}));

describe('AIProviderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with OpenAI provider', () => {
      const service = new AIProviderService({
        provider: 'openai',
        apiKey: 'sk-test-key',
      });

      expect(service).toBeDefined();
    });

    it('should initialize with Anthropic provider', () => {
      const service = new AIProviderService({
        provider: 'anthropic',
        apiKey: 'sk-ant-test-key',
      });

      expect(service).toBeDefined();
    });

    it('should use default model when not specified', () => {
      const service = new AIProviderService({
        provider: 'openai',
        apiKey: 'sk-test-key',
      });

      expect(service).toBeDefined();
    });

    it('should use custom model when specified', () => {
      const service = new AIProviderService({
        provider: 'openai',
        apiKey: 'sk-test-key',
        model: 'gpt-4',
      });

      expect(service).toBeDefined();
    });

    it('should throw error for unsupported provider', () => {
      expect(() => {
        new AIProviderService({
          // @ts-expect-error Testing invalid provider
          provider: 'unsupported',
          apiKey: 'test-key',
        });
      }).toThrow(UnknownProviderError);
    });
  });

  describe('createChatCompletion', () => {
    it('should successfully create chat completion', async () => {
      const mockResponse = {
        text: 'Hello, how can I help you?',
        usage: { totalTokens: 50 },
      };

      vi.mocked(generateText).mockResolvedValueOnce(mockResponse as any);

      const service = new AIProviderService({
        provider: 'openai',
        apiKey: 'sk-test-key',
      });

      const result = await service.createChatCompletion([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result).toEqual({
        content: 'Hello, how can I help you?',
        usage: { total_tokens: 50 },
      });

      expect(generateText).toHaveBeenCalledWith({
        model: 'mock-openai-model',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        maxTokens: 1000,
      });
    });

    it('should inject system prompt when provided', async () => {
      const mockResponse = {
        text: 'Response with system prompt',
        usage: { totalTokens: 60 },
      };

      vi.mocked(generateText).mockResolvedValueOnce(mockResponse as any);

      const service = new AIProviderService(
        {
          provider: 'openai',
          apiKey: 'sk-test-key',
        },
        'You are a helpful assistant'
      );

      await service.createChatCompletion([{ role: 'user', content: 'Hello' }]);

      expect(generateText).toHaveBeenCalledWith({
        model: 'mock-openai-model',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello' },
        ],
        temperature: 0.7,
        maxTokens: 1000,
      });
    });

    it('should retry on retryable errors', async () => {
      const error = { status: 429, message: 'Rate limit exceeded' };
      const mockResponse = {
        text: 'Success after retry',
        usage: { totalTokens: 40 },
      };

      vi.mocked(generateText)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockResponse as any);

      const service = new AIProviderService(
        {
          provider: 'openai',
          apiKey: 'sk-test-key',
        },
        undefined,
        { maxRetries: 2, baseDelay: 10 }
      );

      const result = await service.createChatCompletion([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result.content).toBe('Success after retry');
      expect(generateText).toHaveBeenCalledTimes(2);
    });

    it('should throw AIProviderError for 401 errors', async () => {
      const error = { status: 401, message: 'Unauthorized' };
      vi.mocked(generateText).mockRejectedValue(error);

      const service = new AIProviderService({
        provider: 'openai',
        apiKey: 'sk-test-key',
      });

      await expect(
        service.createChatCompletion([{ role: 'user', content: 'Hello' }])
      ).rejects.toThrow(AIProviderError);

      await expect(
        service.createChatCompletion([{ role: 'user', content: 'Hello' }])
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_API_KEY',
      });
    });

    it('should handle quota exceeded errors', async () => {
      const error = { status: 429, message: 'Insufficient quota' };
      vi.mocked(generateText).mockRejectedValueOnce(error);

      const service = new AIProviderService(
        {
          provider: 'openai',
          apiKey: 'sk-test-key',
        },
        undefined,
        { maxRetries: 1 }
      );

      await expect(
        service.createChatCompletion([{ role: 'user', content: 'Hello' }])
      ).rejects.toMatchObject({
        statusCode: 402,
        code: 'INSUFFICIENT_QUOTA',
      });
    });

    it('should allow provider override at runtime', async () => {
      const mockResponse = {
        text: 'Response from Anthropic',
        usage: { totalTokens: 30 },
      };

      vi.mocked(generateText).mockResolvedValueOnce(mockResponse as any);

      const service = new AIProviderService(
        {
          provider: 'openai',
          apiKey: 'sk-test-key',
        },
        undefined,
        {
          apiKeys: {
            openai: 'sk-test-key',
            anthropic: 'sk-ant-test-key',
          },
        }
      );

      const result = await service.createChatCompletion(
        [{ role: 'user', content: 'Hello' }],
        undefined,
        'anthropic'
      );

      expect(result.content).toBe('Response from Anthropic');
      expect(generateText).toHaveBeenCalledWith({
        model: 'mock-anthropic-model',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        maxTokens: 1000,
      });
    });

    it('should allow model override at runtime', async () => {
      const mockResponse = {
        text: 'Response from GPT-4',
        usage: { totalTokens: 35 },
      };

      vi.mocked(generateText).mockResolvedValueOnce(mockResponse as any);

      const service = new AIProviderService(
        {
          provider: 'openai',
          apiKey: 'sk-test-key',
        },
        undefined,
        {
          apiKeys: {
            openai: 'sk-test-key',
          },
        }
      );

      const result = await service.createChatCompletion(
        [{ role: 'user', content: 'Hello' }],
        undefined,
        undefined,
        'gpt-4'
      );

      expect(result.content).toBe('Response from GPT-4');
    });

    it('should throw error when API key is missing for override provider', async () => {
      const service = new AIProviderService(
        {
          provider: 'openai',
          apiKey: 'sk-test-key',
        },
        undefined,
        {
          apiKeys: {
            openai: 'sk-test-key',
            // anthropic key missing
          },
        }
      );

      await expect(
        service.createChatCompletion(
          [{ role: 'user', content: 'Hello' }],
          undefined,
          'anthropic'
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'MISSING_API_KEY',
        message: 'API key not configured for provider: anthropic',
      });
    });

    it('should throw error for invalid provider override', async () => {
      const service = new AIProviderService(
        {
          provider: 'openai',
          apiKey: 'sk-test-key',
        },
        undefined,
        {
          apiKeys: {
            openai: 'sk-test-key',
          },
        }
      );

      await expect(
        service.createChatCompletion(
          [{ role: 'user', content: 'Hello' }],
          undefined,
          'invalid-provider'
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_PROVIDER',
        message: 'Unsupported provider: invalid-provider',
      });
    });

    it('should handle both provider and model overrides together', async () => {
      const mockResponse = {
        text: 'Response from Claude 3 Opus',
        usage: { totalTokens: 40 },
      };

      vi.mocked(generateText).mockResolvedValueOnce(mockResponse as any);

      const service = new AIProviderService(
        {
          provider: 'openai',
          apiKey: 'sk-test-key',
          model: 'gpt-4o-mini',
        },
        undefined,
        {
          apiKeys: {
            openai: 'sk-test-key',
            anthropic: 'sk-ant-test-key',
          },
        }
      );

      const result = await service.createChatCompletion(
        [{ role: 'user', content: 'Hello' }],
        undefined,
        'anthropic',
        'claude-3-opus-20240229'
      );

      expect(result.content).toBe('Response from Claude 3 Opus');
    });

    it('should use correct provider in error messages when using override', async () => {
      const error = { status: 401, message: 'Unauthorized' };
      vi.mocked(generateText).mockRejectedValue(error);

      const service = new AIProviderService(
        {
          provider: 'openai',
          apiKey: 'sk-test-key',
        },
        undefined,
        {
          apiKeys: {
            openai: 'sk-test-key',
            anthropic: 'sk-ant-test-key',
          },
        }
      );

      await expect(
        service.createChatCompletion(
          [{ role: 'user', content: 'Hello' }],
          undefined,
          'anthropic'
        )
      ).rejects.toMatchObject({
        message: 'Invalid ANTHROPIC API key',
        statusCode: 401,
        code: 'INVALID_API_KEY',
      });
    });
  });

  describe('supportsFeature', () => {
    it('should return true for supported features', () => {
      const service = new AIProviderService({
        provider: 'openai',
        apiKey: 'sk-test-key',
      });

      expect(service.supportsFeature('streaming')).toBe(true);
      expect(service.supportsFeature('functionCalling')).toBe(true);
      expect(service.supportsFeature('vision')).toBe(true);
    });

    it('should return correct features for each provider', () => {
      const openaiService = new AIProviderService({
        provider: 'openai',
        apiKey: 'sk-test-key',
      });

      const anthropicService = new AIProviderService({
        provider: 'anthropic',
        apiKey: 'sk-ant-test-key',
      });

      // Both should support the same features for now
      expect(openaiService.supportsFeature('streaming')).toBe(
        PROVIDER_FEATURES.openai.streaming
      );
      expect(anthropicService.supportsFeature('streaming')).toBe(
        PROVIDER_FEATURES.anthropic.streaming
      );
    });
  });
});
