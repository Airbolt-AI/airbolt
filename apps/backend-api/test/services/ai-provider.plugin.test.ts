import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import aiProviderPlugin from '@airbolt/core/services/ai-provider.js';
import envPlugin from '@airbolt/core/plugins/env.js';
import { createTestEnv } from '@airbolt/test-utils';

// Mock the AI SDK modules
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

describe('AI Provider Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTestEnv();
  });

  it('should register AI provider service with OpenAI', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-test-key';
    process.env['AI_PROVIDER'] = 'openai';

    const fastify = Fastify();
    await fastify.register(envPlugin);
    await fastify.register(aiProviderPlugin);

    expect(fastify.aiProvider).toBeDefined();
  });

  it('should register AI provider service with Anthropic', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-key';
    process.env['AI_PROVIDER'] = 'anthropic';

    const fastify = Fastify();
    await fastify.register(envPlugin);
    await fastify.register(aiProviderPlugin);

    expect(fastify.aiProvider).toBeDefined();
  });

  it('should use OpenAI as default provider', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-test-key';
    delete process.env['AI_PROVIDER'];

    const fastify = Fastify();
    await fastify.register(envPlugin);
    await fastify.register(aiProviderPlugin);

    expect(fastify.aiProvider).toBeDefined();
  });

  it('should throw error when API key is missing', async () => {
    process.env['AI_PROVIDER'] = 'openai';
    delete process.env['OPENAI_API_KEY'];

    const fastify = Fastify();

    await expect(async () => {
      await fastify.register(envPlugin);
      await fastify.register(aiProviderPlugin);
    }).rejects.toThrow();
  });

  it('should use custom model when AI_MODEL is set', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-test-key';
    process.env['AI_PROVIDER'] = 'openai';
    process.env['AI_MODEL'] = 'gpt-4';

    const fastify = Fastify();
    await fastify.register(envPlugin);
    await fastify.register(aiProviderPlugin);

    expect(fastify.aiProvider).toBeDefined();
  });

  it('should use system prompt from environment', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-test-key';
    process.env['AI_PROVIDER'] = 'openai';
    process.env['SYSTEM_PROMPT'] = 'You are a helpful assistant';

    const fastify = Fastify();
    await fastify.register(envPlugin);
    await fastify.register(aiProviderPlugin);

    expect(fastify.aiProvider).toBeDefined();
  });

  it('should throw error for unsupported provider', async () => {
    process.env['AI_PROVIDER'] = 'unsupported';
    process.env['OPENAI_API_KEY'] = 'sk-test-key';

    const fastify = Fastify();

    await expect(async () => {
      await fastify.register(envPlugin);
      await fastify.register(aiProviderPlugin);
    }).rejects.toThrow();
  });

  it('should log successful registration', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-test-key';
    process.env['AI_PROVIDER'] = 'openai';

    const fastify = Fastify({ logger: true });

    const logSpy = vi.spyOn(fastify.log, 'info');

    await fastify.register(envPlugin);
    await fastify.register(aiProviderPlugin);

    expect(logSpy).toHaveBeenCalledWith(
      'AI Provider service registered successfully (provider: openai)'
    );
  });

  it('should properly decorate fastify instance', async () => {
    process.env['OPENAI_API_KEY'] = 'sk-test-key';

    const fastify = Fastify();
    await fastify.register(envPlugin);

    expect(fastify.aiProvider).toBeUndefined();

    await fastify.register(aiProviderPlugin);

    expect(fastify.aiProvider).toBeDefined();
    expect(typeof fastify.aiProvider.createChatCompletion).toBe('function');
    expect(typeof fastify.aiProvider.supportsFeature).toBe('function');
  });
});
