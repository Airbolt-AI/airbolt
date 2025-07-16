import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AirboltClient, ColdStartError } from '../../src/core';
import { AirboltAPI } from '../../generated';

// Mock the generated client
vi.mock('../../generated', () => {
  const mockAirboltAPIClient = vi.fn();
  return {
    AirboltAPIClient: mockAirboltAPIClient,
    AirboltAPI: {
      UnauthorizedError: class UnauthorizedError extends Error {
        constructor(_body: any, _rawResponse?: any) {
          super('Unauthorized');
        }
      },
    },
  };
});

// Mock console to verify logging
const originalConsoleInfo = console.info;

// Import mocked modules
import { AirboltAPIClient } from '../../generated';
const MockedAirboltAPIClient = vi.mocked(AirboltAPIClient);

describe('AirboltClient cold start retry', () => {
  let mockSendChat: ReturnType<typeof vi.fn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendChat = vi.fn();
    MockedAirboltAPIClient.mockImplementation(
      () =>
        ({
          chat: {
            sendChatMessagesToAi: mockSendChat,
          },
        }) as any
    );

    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    console.info = originalConsoleInfo;
  });

  describe('timeout handling', () => {
    it('should pass configured timeout on normal requests', async () => {
      const client = new AirboltClient({
        baseURL: 'http://test.com',
        timeoutSeconds: 30,
      });

      mockSendChat.mockResolvedValue({
        content: 'Hello!',
        usage: { total_tokens: 10 },
      });

      await client.chat([{ role: 'user', content: 'Hi' }]);

      expect(mockSendChat).toHaveBeenCalledWith(expect.any(Object), {
        timeoutInSeconds: 30,
      });
    });

    it('should use default 60s timeout when not configured', async () => {
      const client = new AirboltClient({
        baseURL: 'http://test.com',
      });

      mockSendChat.mockResolvedValue({
        content: 'Hello!',
        usage: { total_tokens: 10 },
      });

      await client.chat([{ role: 'user', content: 'Hi' }]);

      expect(mockSendChat).toHaveBeenCalledWith(expect.any(Object), {
        timeoutInSeconds: 60,
      });
    });
  });

  describe('cold start retry logic', () => {
    it('should retry with double timeout on first timeout error', async () => {
      const onColdStartDetected = vi.fn();
      const client = new AirboltClient({
        baseURL: 'http://test.com',
        timeoutSeconds: 45,
        onColdStartDetected,
      });

      // First call times out
      const timeoutError = new Error(
        'Timeout exceeded when calling POST /api/chat.'
      );
      timeoutError.name = 'AirboltAPITimeoutError';
      (timeoutError as any).constructor = { name: 'AirboltAPITimeoutError' };

      mockSendChat.mockRejectedValueOnce(timeoutError).mockResolvedValueOnce({
        content: 'Hello after retry!',
        usage: { total_tokens: 10 },
      });

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);

      // Should have called twice
      expect(mockSendChat).toHaveBeenCalledTimes(2);

      // First call with normal timeout
      expect(mockSendChat).toHaveBeenNthCalledWith(1, expect.any(Object), {
        timeoutInSeconds: 45,
      });

      // Second call with double timeout
      expect(mockSendChat).toHaveBeenNthCalledWith(2, expect.any(Object), {
        timeoutInSeconds: 90,
      });

      // Callback should have been called
      expect(onColdStartDetected).toHaveBeenCalledTimes(1);

      // Should log info message
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[Airbolt] Server appears to be starting up. Retrying with extended timeout...'
      );

      // Should return successful result
      expect(result).toEqual({
        content: 'Hello after retry!',
        usage: { total_tokens: 10 },
      });
    });

    it('should throw ColdStartError if retry also times out', async () => {
      const client = new AirboltClient({
        baseURL: 'http://test.com',
      });

      const timeoutError = new Error('Timeout exceeded');
      timeoutError.name = 'AirboltAPITimeoutError';
      (timeoutError as any).constructor = { name: 'AirboltAPITimeoutError' };

      // Both attempts timeout
      mockSendChat.mockRejectedValue(timeoutError);

      await expect(
        client.chat([{ role: 'user', content: 'Hi' }])
      ).rejects.toThrow(ColdStartError);

      expect(mockSendChat).toHaveBeenCalledTimes(2);
    });

    it('should only retry once per session', async () => {
      const client = new AirboltClient({
        baseURL: 'http://test.com',
      });

      const timeoutError = new Error('Timeout exceeded');
      timeoutError.name = 'AirboltAPITimeoutError';
      (timeoutError as any).constructor = { name: 'AirboltAPITimeoutError' };

      // First request: timeout then success
      mockSendChat
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({ content: 'Success 1' });

      await client.chat([{ role: 'user', content: 'First' }]);
      expect(mockSendChat).toHaveBeenCalledTimes(2);

      // Second request: timeout should not retry
      mockSendChat.mockRejectedValueOnce(timeoutError);

      await expect(
        client.chat([{ role: 'user', content: 'Second' }])
      ).rejects.toThrow(timeoutError);

      // Should only have made one more call (no retry)
      expect(mockSendChat).toHaveBeenCalledTimes(3);
    });

    it('should not retry for non-timeout errors', async () => {
      const client = new AirboltClient({
        baseURL: 'http://test.com',
      });

      const networkError = new Error('Network error');
      mockSendChat.mockRejectedValue(networkError);

      await expect(
        client.chat([{ role: 'user', content: 'Hi' }])
      ).rejects.toThrow(networkError);

      // Should only call once (no retry)
      expect(mockSendChat).toHaveBeenCalledTimes(1);
    });

    it('should handle 401 errors before timeout retry', async () => {
      const client = new AirboltClient({
        baseURL: 'http://test.com',
      });

      const unauthorizedError = new AirboltAPI.UnauthorizedError({
        message: 'Unauthorized',
      });
      mockSendChat
        .mockRejectedValueOnce(unauthorizedError)
        .mockResolvedValueOnce({ content: 'Success after auth retry' });

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);

      expect(mockSendChat).toHaveBeenCalledTimes(2);
      expect(result.content).toBe('Success after auth retry');
    });
  });

  describe('edge cases', () => {
    it('should handle timeout errors with different formats', async () => {
      const client = new AirboltClient({
        baseURL: 'http://test.com',
        onColdStartDetected: vi.fn(),
      });

      // Test AbortError
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      mockSendChat
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce({ content: 'Success' });

      await client.chat([{ role: 'user', content: 'Hi' }]);

      expect(mockSendChat).toHaveBeenCalledTimes(2);
    });

    it('should pass through retry errors that are not timeouts', async () => {
      const client = new AirboltClient({
        baseURL: 'http://test.com',
      });

      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AirboltAPITimeoutError';
      (timeoutError as any).constructor = { name: 'AirboltAPITimeoutError' };

      const networkError = new Error('Network failed');

      mockSendChat
        .mockRejectedValueOnce(timeoutError)
        .mockRejectedValueOnce(networkError);

      await expect(
        client.chat([{ role: 'user', content: 'Hi' }])
      ).rejects.toThrow(networkError);
    });
  });
});
