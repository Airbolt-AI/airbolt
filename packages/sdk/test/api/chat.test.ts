import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chat } from '../../src/api/chat';
import { AirboltClient } from '../../src/core/fern-client';
import type { Message } from '../../src/api/types';

// Mock the AirboltClient
vi.mock('../../src/core/fern-client');

describe('chat', () => {
  const mockChat = vi.fn();
  const mockClientConstructor = vi.mocked(AirboltClient);

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock client instance
    mockClientConstructor.mockImplementation(
      () =>
        ({
          chat: mockChat,
        }) as any
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should send messages and return assistant content', async () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    const expectedResponse = 'Hello! How can I help you today?';

    mockChat.mockResolvedValue({
      content: expectedResponse,
      usage: { total_tokens: 15 },
    });

    const result = await chat(messages);

    expect(result).toBe(expectedResponse);
    expect(mockClientConstructor).toHaveBeenCalledWith({
      baseURL: 'http://localhost:3000',
    });
    expect(mockChat).toHaveBeenCalledWith(messages, {
      provider: undefined,
      model: undefined,
    });
  });

  it('should pass baseURL option to client', async () => {
    const messages: Message[] = [{ role: 'user', content: 'Test' }];
    const baseURL = 'https://custom.api.com';

    mockChat.mockResolvedValue({
      content: 'Test response',
      usage: { total_tokens: 10 },
    });

    await chat(messages, { baseURL });

    expect(mockClientConstructor).toHaveBeenCalledWith({ baseURL });
  });

  it('should pass system prompt when provided', async () => {
    const messages: Message[] = [{ role: 'user', content: 'Tell me a joke' }];
    const system = 'You are a comedian who tells funny jokes';

    mockChat.mockResolvedValue({
      content: 'Why did the chicken cross the road? To get to the other side!',
      usage: { total_tokens: 25 },
    });

    await chat(messages, { system });

    expect(mockChat).toHaveBeenCalledWith(
      [{ role: 'system', content: system }, ...messages],
      {
        provider: undefined,
        model: undefined,
      }
    );
  });

  it('should handle multiple messages in conversation', async () => {
    const messages: Message[] = [
      { role: 'user', content: 'What is 2+2?' },
      { role: 'assistant', content: '2+2 equals 4' },
      { role: 'user', content: 'What about 3+3?' },
    ];

    mockChat.mockResolvedValue({
      content: '3+3 equals 6',
      usage: { total_tokens: 30 },
    });

    const result = await chat(messages);

    expect(result).toBe('3+3 equals 6');
    expect(mockChat).toHaveBeenCalledWith(messages, {
      provider: undefined,
      model: undefined,
    });
  });

  it('should propagate errors from AirboltClient', async () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    const error = new Error('Network error');

    mockChat.mockRejectedValue(error);

    await expect(chat(messages)).rejects.toThrow('Network error');
  });

  it('should handle empty messages array', async () => {
    const messages: Message[] = [];

    mockChat.mockResolvedValue({
      content: 'No messages provided',
      usage: { total_tokens: 5 },
    });

    const result = await chat(messages);

    expect(result).toBe('No messages provided');
    expect(mockChat).toHaveBeenCalledWith([], {
      provider: undefined,
      model: undefined,
    });
  });

  it('should handle both baseURL and system options together', async () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    const options = {
      baseURL: 'https://api.custom.com',
      system: 'You are a helpful assistant',
    };

    mockChat.mockResolvedValue({
      content: 'Hello! I am here to help.',
      usage: { total_tokens: 20 },
    });

    await chat(messages, options);

    expect(mockClientConstructor).toHaveBeenCalledWith({
      baseURL: options.baseURL,
    });
    expect(mockChat).toHaveBeenCalledWith(
      [{ role: 'system', content: options.system }, ...messages],
      {
        provider: undefined,
        model: undefined,
      }
    );
  });

  it('should pass provider and model options to client', async () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    const options = {
      provider: 'anthropic' as const,
      model: 'claude-3-5-sonnet-20241022',
    };

    mockChat.mockResolvedValue({
      content: 'Hello from Claude!',
      usage: { total_tokens: 15 },
    });

    await chat(messages, options);

    expect(mockChat).toHaveBeenCalledWith(messages, {
      provider: options.provider,
      model: options.model,
    });
  });

  it('should pass all options together', async () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    const options = {
      baseURL: 'https://api.custom.com',
      system: 'You are a helpful assistant',
      provider: 'openai' as const,
      model: 'gpt-4',
    };

    mockChat.mockResolvedValue({
      content: 'Hello! I am GPT-4.',
      usage: { total_tokens: 25 },
    });

    await chat(messages, options);

    expect(mockClientConstructor).toHaveBeenCalledWith({
      baseURL: options.baseURL,
    });
    expect(mockChat).toHaveBeenCalledWith(
      [{ role: 'system', content: options.system }, ...messages],
      {
        provider: options.provider,
        model: options.model,
      }
    );
  });
});
