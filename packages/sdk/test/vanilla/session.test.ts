import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChatSession } from '../../src/vanilla/session';
import type { ChatSession } from '../../src/vanilla/types';

// Mock the chat module
vi.mock('../../src/vanilla/chat', () => ({
  chat: vi.fn()
}));

// Import chat after mocking
import { chat } from '../../src/vanilla/chat';

describe('createChatSession', () => {
  const mockChat = vi.mocked(chat);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  it('should create a new chat session', () => {
    const session = createChatSession();
    
    expect(session).toBeDefined();
    expect(session.send).toBeInstanceOf(Function);
    expect(session.getMessages).toBeInstanceOf(Function);
    expect(session.clear).toBeInstanceOf(Function);
  });

  it('should send messages and track conversation history', async () => {
    const session = createChatSession();
    
    mockChat.mockResolvedValueOnce('Hello! How can I help you?');
    
    const response = await session.send('Hello');
    
    expect(response).toBe('Hello! How can I help you?');
    expect(mockChat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Hello' }],
      undefined
    );
    
    const messages = session.getMessages();
    expect(messages).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hello! How can I help you?' }
    ]);
  });

  it('should maintain conversation context across multiple messages', async () => {
    const session = createChatSession();
    
    // First exchange
    mockChat.mockResolvedValueOnce('2+2 equals 4');
    await session.send('What is 2+2?');
    
    // Second exchange - should include full history
    mockChat.mockResolvedValueOnce('You asked what 2+2 equals');
    const response = await session.send('What did I just ask?');
    
    expect(response).toBe('You asked what 2+2 equals');
    expect(mockChat).toHaveBeenLastCalledWith(
      [
        { role: 'user', content: 'What is 2+2?' },
        { role: 'assistant', content: '2+2 equals 4' },
        { role: 'user', content: 'What did I just ask?' }
      ],
      undefined
    );
    
    const messages = session.getMessages();
    expect(messages).toHaveLength(4);
  });

  it('should pass baseURL to chat function', async () => {
    const baseURL = 'https://custom.api.com';
    const session = createChatSession(baseURL);
    
    mockChat.mockResolvedValueOnce('Response');
    
    await session.send('Test');
    
    expect(mockChat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Test' }],
      { baseURL }
    );
  });

  it('should return read-only messages array', () => {
    const session = createChatSession();
    const messages = session.getMessages();
    
    expect(() => {
      (messages as any).push({ role: 'user', content: 'Hack' });
    }).toThrow();
    
    expect(Object.isFrozen(messages)).toBe(true);
  });

  it('should clear all messages when clear() is called', async () => {
    const session = createChatSession();
    
    mockChat.mockResolvedValueOnce('First response');
    await session.send('First message');
    
    expect(session.getMessages()).toHaveLength(2);
    
    session.clear();
    
    expect(session.getMessages()).toHaveLength(0);
  });

  it('should continue working after clear()', async () => {
    const session = createChatSession();
    
    // First message
    mockChat.mockResolvedValueOnce('First response');
    await session.send('First');
    
    // Clear
    session.clear();
    
    // New message after clear
    mockChat.mockResolvedValueOnce('New response');
    const response = await session.send('New message');
    
    expect(response).toBe('New response');
    expect(mockChat).toHaveBeenLastCalledWith(
      [{ role: 'user', content: 'New message' }],
      undefined
    );
    expect(session.getMessages()).toHaveLength(2);
  });

  it('should propagate errors from chat function', async () => {
    const session = createChatSession();
    const error = new Error('Network error');
    
    mockChat.mockRejectedValueOnce(error);
    
    await expect(session.send('Test')).rejects.toThrow('Network error');
    
    // Messages should still be added even if chat fails
    expect(session.getMessages()).toHaveLength(1);
    expect(session.getMessages()[0]).toEqual({ role: 'user', content: 'Test' });
  });

  it('should handle empty messages', async () => {
    const session = createChatSession();
    
    mockChat.mockResolvedValueOnce('Empty message response');
    
    const response = await session.send('');
    
    expect(response).toBe('Empty message response');
    expect(session.getMessages()).toEqual([
      { role: 'user', content: '' },
      { role: 'assistant', content: 'Empty message response' }
    ]);
  });

  it('should create independent sessions', async () => {
    const session1 = createChatSession();
    const session2 = createChatSession();
    
    mockChat.mockResolvedValueOnce('Response 1');
    await session1.send('Message 1');
    
    mockChat.mockResolvedValueOnce('Response 2');
    await session2.send('Message 2');
    
    expect(session1.getMessages()).toHaveLength(2);
    expect(session2.getMessages()).toHaveLength(2);
    
    expect(session1.getMessages()[0].content).toBe('Message 1');
    expect(session2.getMessages()[0].content).toBe('Message 2');
  });
});