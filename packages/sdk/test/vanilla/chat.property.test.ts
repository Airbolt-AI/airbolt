import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { chat } from '../../src/vanilla/chat';
import { AirboltClient } from '../../src/core/client';
import type { Message } from '../../src/vanilla/types';

// Mock the AirboltClient
vi.mock('../../src/core/client');

describe('chat - property-based tests', () => {
  const mockChat = vi.fn();
  const mockClientConstructor = vi.mocked(AirboltClient);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock client instance
    mockClientConstructor.mockImplementation(() => ({
      chat: mockChat,
    } as any));
  });

  it('should handle any valid message content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            role: fc.constantFrom('user' as const, 'assistant' as const),
            content: fc.string({ minLength: 0, maxLength: 10000 })
          })
        ),
        async (messages) => {
          const expectedResponse = 'Test response';
          mockChat.mockResolvedValue({
            content: expectedResponse,
            usage: { total_tokens: 10 }
          });

          const result = await chat(messages as Message[]);
          
          expect(result).toBe(expectedResponse);
          expect(mockChat).toHaveBeenCalledWith({
            messages,
            system: undefined
          });
        }
      )
    );
  });

  it('should handle any valid baseURL format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(),
        async (baseURL) => {
          const messages: Message[] = [{ role: 'user', content: 'Test' }];
          
          mockChat.mockResolvedValue({
            content: 'Response',
            usage: { total_tokens: 5 }
          });

          await chat(messages, { baseURL });
          
          expect(mockClientConstructor).toHaveBeenCalledWith({ baseURL });
        }
      )
    );
  });

  it('should handle any valid system prompt', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 5000 }),
        async (system) => {
          const messages: Message[] = [{ role: 'user', content: 'Test' }];
          
          mockChat.mockResolvedValue({
            content: 'Response',
            usage: { total_tokens: 5 }
          });

          await chat(messages, { system });
          
          // When system is empty string, it shouldn't be included
          const expectedCall = system ? { messages, system } : { messages };
          expect(mockChat).toHaveBeenCalledWith(expectedCall);
        }
      )
    );
  });

  it('should maintain message order in conversations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1, maxLength: 100 }),
          { minLength: 1, maxLength: 20 }
        ),
        async (contents) => {
          // Build alternating user/assistant messages
          const messages: Message[] = contents.map((content, index) => ({
            role: index % 2 === 0 ? 'user' : 'assistant',
            content
          }));
          
          mockChat.mockResolvedValue({
            content: 'Final response',
            usage: { total_tokens: 50 }
          });

          await chat(messages);
          
          // Verify the exact message array was passed
          expect(mockChat).toHaveBeenCalledWith({
            messages,
            system: undefined
          });
        }
      )
    );
  });

  it('should handle edge cases for message content', async () => {
    const edgeCases = [
      '',  // empty string
      ' ',  // whitespace
      '\n\n\n',  // newlines
      '🎉🎊🎈',  // emojis
      '\\n\\t\\r',  // escape sequences
      '<script>alert("xss")</script>',  // HTML
      '${injection}',  // template literals
      'null',  // string "null"
      'undefined',  // string "undefined"
      JSON.stringify({ nested: 'object' }),  // JSON string
    ];

    for (const content of edgeCases) {
      const messages: Message[] = [{ role: 'user', content }];
      
      mockChat.mockResolvedValue({
        content: 'Safe response',
        usage: { total_tokens: 10 }
      });

      const result = await chat(messages);
      
      expect(result).toBe('Safe response');
      expect(mockChat).toHaveBeenCalledWith({
        messages: [{ role: 'user', content }],
        system: undefined
      });
    }
  });

  it('should handle special characters in system prompts', async () => {
    const specialPrompts = [
      'You are a $ROLE with {abilities}',
      'System\\nPrompt\\tWith\\rEscapes',
      'Unicode: 你好世界 🌍',
      '```code block```',
      '"quoted" and \'single quoted\'',
    ];

    for (const system of specialPrompts) {
      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      
      mockChat.mockResolvedValue({
        content: 'Response',
        usage: { total_tokens: 5 }
      });

      await chat(messages, { system });
      
      expect(mockChat).toHaveBeenCalledWith({
        messages,
        system
      });
    }
  });
});