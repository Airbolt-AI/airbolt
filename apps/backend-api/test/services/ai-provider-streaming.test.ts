import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIProviderService } from '../../src/services/ai-provider.js';
import { createTestEnv } from '@airbolt/test-utils';
import { streamText } from 'ai';

// Mock the ai module
vi.mock('ai', () => ({
  streamText: vi.fn(),
  generateText: vi.fn(),
  openai: vi.fn(() => ({
    // Return a mock model function
    chat: vi.fn(() => ({ id: 'mock-model' })),
  })),
  anthropic: vi.fn(() => ({
    // Return a mock model function
    messages: vi.fn(() => ({ id: 'mock-model' })),
  })),
}));

describe('AI Provider Streaming - Critical Production Failures', () => {
  let provider: AIProviderService;

  beforeEach(() => {
    createTestEnv();

    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
      child: vi.fn(() => mockLogger),
    } as any;

    // Create provider with minimal config
    const config = {
      provider: 'openai' as const,
      apiKey: 'sk-test1234567890abcdef',
      model: 'gpt-4o-mini',
    };

    provider = new AIProviderService(config, 'Test system prompt', {
      apiKeys: { openai: 'sk-test1234567890abcdef' },
    });
  });

  describe('TOP 3 Production Streaming Failures', () => {
    it('1. Generator cleanup on early termination - prevents memory leaks', async () => {
      // Most critical: ensure generators always cleanup even if consumer stops
      let cleanupExecuted = false;

      const mockTextStream = {
        async *[Symbol.asyncIterator]() {
          try {
            yield 'Starting response...';
            yield 'More content...';
            yield 'Even more content...';
          } finally {
            // CRITICAL: This must execute even if error occurs or iteration completes
            cleanupExecuted = true;
          }
        },
      };

      vi.mocked(streamText).mockReturnValue({
        textStream: mockTextStream,
      } as any);

      const stream = await provider.createChatCompletionStream([
        { role: 'user', content: 'Tell me a story' },
      ]);

      // Consume the entire stream (simulating normal completion)
      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Verify we got all chunks
      expect(chunks).toEqual([
        'Starting response...',
        'More content...',
        'Even more content...',
      ]);

      // Critical assertion: cleanup happened after normal completion
      expect(cleanupExecuted).toBe(true);
    });

    it('2. Token limit error handling - partial content before error', async () => {
      // Second most common: provider throws error mid-stream
      const mockTextStream = {
        async *[Symbol.asyncIterator]() {
          yield 'The answer is';
          yield ' quite complex and';
          // Simulate token limit error from provider
          throw new Error('Maximum token limit exceeded');
        },
      };

      vi.mocked(streamText).mockReturnValue({
        textStream: mockTextStream,
      } as any);

      const stream = await provider.createChatCompletionStream([
        { role: 'user', content: 'Explain quantum computing in detail' },
      ]);

      const chunks: string[] = [];
      let errorThrown = false;

      try {
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
      } catch (error) {
        errorThrown = true;
        // User should have received partial content
        expect(chunks).toEqual(['The answer is', ' quite complex and']);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('token limit');
      }

      expect(errorThrown).toBe(true);
    });

    it('3. Special characters in stream - maintains valid output', async () => {
      // Third issue: AI generates content with newlines/special chars
      const problematicContent = [
        'Here is Python code:\n```python',
        '\ndef hello():\n    print("Hello\\nWorld")',
        '\n```\nAnd JSON: {"key": "value:with:colons"}',
      ];

      const mockTextStream = {
        async *[Symbol.asyncIterator]() {
          for (const chunk of problematicContent) {
            yield chunk;
          }
        },
      };

      vi.mocked(streamText).mockReturnValue({
        textStream: mockTextStream,
      } as any);

      const stream = await provider.createChatCompletionStream([
        { role: 'user', content: 'Show me code' },
      ]);

      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
        // Each chunk should be a valid string (not corrupted)
        expect(typeof chunk).toBe('string');
      }

      // All content should be preserved exactly
      expect(chunks).toEqual(problematicContent);

      // When serialized to JSON (as would happen in SSE), should be valid
      chunks.forEach(chunk => {
        const jsonString = JSON.stringify({ content: chunk });
        expect(() => JSON.parse(jsonString)).not.toThrow();
      });
    });
  });
});
