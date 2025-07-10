/**
 * Tests for the Fern-based AirboltClient wrapper
 *
 * These tests verify that our minimal auth wrapper correctly integrates
 * with the Fern-generated client while maintaining automatic JWT management.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AirboltClient } from '../../src/core/fern-client.js';
import { TokenManager } from '../../src/core/token-manager.js';
import { AirboltAPIClient, AirboltAPI } from '../../generated/browser/index.js';

// Mock the generated client
vi.mock('../../generated/browser/index.js', () => ({
  AirboltAPIClient: vi.fn(),
  AirboltAPI: {
    UnauthorizedError: class UnauthorizedError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'UnauthorizedError';
      }
    },
    BadRequestError: class BadRequestError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'BadRequestError';
      }
    },
  },
  AirboltAPIError: class AirboltAPIError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AirboltAPIError';
    }
  },
}));

describe('AirboltClient (Fern-based)', () => {
  let client: AirboltClient;
  let mockTokenManager: TokenManager;
  let mockFernClient: any;
  let mockSendChatMessagesToAi: Mock;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock TokenManager
    mockTokenManager = {
      getToken: vi.fn().mockResolvedValue('test-jwt-token'),
      clearToken: vi.fn(),
      hasValidToken: vi.fn().mockReturnValue(true),
      getTokenInfo: vi.fn().mockReturnValue({
        hasToken: true,
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
      }),
    } as any;

    // Create mock Fern client methods
    mockSendChatMessagesToAi = vi.fn().mockResolvedValue({
      content: 'AI response',
      usage: { total_tokens: 100 },
    });

    mockFernClient = {
      chat: {
        sendChatMessagesToAi: mockSendChatMessagesToAi,
      },
      _options: {
        baseUrl: 'http://localhost:3000',
      },
    };

    // Mock the AirboltAPIClient constructor
    (AirboltAPIClient as unknown as Mock).mockImplementation(
      () => mockFernClient
    );

    // Create client with mocked token manager
    client = new AirboltClient({
      baseURL: 'http://localhost:3000',
      tokenManager: mockTokenManager,
    });
  });

  describe('Constructor', () => {
    it('should initialize with provided options', () => {
      expect(AirboltAPIClient).toHaveBeenCalledWith({
        baseUrl: 'http://localhost:3000',
        token: expect.any(Function),
      });
    });

    it('should create TokenManager if not provided', () => {
      const clientWithoutTM = new AirboltClient({
        baseURL: 'http://localhost:3000',
        userId: 'custom-user',
      });
      expect(clientWithoutTM).toBeDefined();
    });

    it('should pass async token supplier to Fern client', async () => {
      const mockConstructor = AirboltAPIClient as unknown as Mock;
      const tokenSupplier = mockConstructor.mock.calls[0]?.[0]?.token;
      expect(tokenSupplier).toBeDefined();

      const token = await tokenSupplier();
      expect(token).toBe('test-jwt-token');
      expect(mockTokenManager.getToken).toHaveBeenCalled();
    });
  });

  describe('chat()', () => {
    it('should send chat messages and return response', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      const response = await client.chat(messages);

      expect(mockSendChatMessagesToAi).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response).toEqual({
        content: 'AI response',
        usage: { total_tokens: 100 },
      });
    });

    it('should handle multiple messages', async () => {
      const messages = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
        { role: 'user' as const, content: 'How are you?' },
      ];

      await client.chat(messages);

      expect(mockSendChatMessagesToAi).toHaveBeenCalledWith({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      });
    });

    it('should handle response without usage data', async () => {
      mockSendChatMessagesToAi.mockResolvedValueOnce({
        content: 'AI response without usage',
      });

      const response = await client.chat([{ role: 'user', content: 'Test' }]);

      expect(response).toEqual({
        content: 'AI response without usage',
      });
      expect(response.usage).toBeUndefined();
    });

    it('should retry once on 401 UnauthorizedError', async () => {
      // First call throws 401, second succeeds
      mockSendChatMessagesToAi
        .mockRejectedValueOnce(
          new AirboltAPI.UnauthorizedError(
            { message: 'Token expired' },
            {} as any
          )
        )
        .mockResolvedValueOnce({
          content: 'Success after retry',
          usage: { total_tokens: 50 },
        });

      const response = await client.chat([
        { role: 'user', content: 'Test retry' },
      ]);

      expect(mockTokenManager.clearToken).toHaveBeenCalledTimes(1);
      expect(mockSendChatMessagesToAi).toHaveBeenCalledTimes(2);
      expect(response).toEqual({
        content: 'Success after retry',
        usage: { total_tokens: 50 },
      });
    });

    it('should not retry on non-401 errors', async () => {
      const badRequestError = new AirboltAPI.BadRequestError('Invalid request');
      mockSendChatMessagesToAi.mockRejectedValueOnce(badRequestError);

      await expect(
        client.chat([{ role: 'user', content: 'Bad request' }])
      ).rejects.toThrow(badRequestError);

      expect(mockTokenManager.clearToken).not.toHaveBeenCalled();
      expect(mockSendChatMessagesToAi).toHaveBeenCalledTimes(1);
    });

    it('should propagate error if retry also fails', async () => {
      const authError = new AirboltAPI.UnauthorizedError(
        { message: 'Token invalid' },
        {} as any
      );
      mockSendChatMessagesToAi
        .mockRejectedValueOnce(authError)
        .mockRejectedValueOnce(authError);

      await expect(
        client.chat([{ role: 'user', content: 'Will fail twice' }])
      ).rejects.toThrow(authError);

      expect(mockTokenManager.clearToken).toHaveBeenCalledTimes(1);
      expect(mockSendChatMessagesToAi).toHaveBeenCalledTimes(2);
    });
  });

  describe('Token management methods', () => {
    it('should clear token', () => {
      client.clearToken();
      expect(mockTokenManager.clearToken).toHaveBeenCalled();
    });

    it('should check if has valid token', () => {
      const result = client.hasValidToken();
      expect(result).toBe(true);
      expect(mockTokenManager.hasValidToken).toHaveBeenCalled();
    });

    it('should get token info', () => {
      const info = client.getTokenInfo();
      expect(info).toEqual({
        hasToken: true,
        expiresAt: expect.any(Date),
        tokenType: 'Bearer',
      });
      expect(mockTokenManager.getTokenInfo).toHaveBeenCalled();
    });
  });

  describe('Utility methods', () => {
    it('should return base URL', () => {
      const baseURL = client.getBaseURL();
      expect(baseURL).toBe('http://localhost:3000');
    });

    it('should provide access to Fern client', () => {
      const fernClient = client.getFernClient();
      expect(fernClient).toBe(mockFernClient);
    });
  });

  describe('Error type exports', () => {
    it('should export Fern error types', () => {
      // These are exported from the module
      expect(AirboltAPI.UnauthorizedError).toBeDefined();
      expect(AirboltAPI.BadRequestError).toBeDefined();
    });
  });
});
