import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AirboltClient, AirboltError } from '../../src/core/client';
import { TokenManager, TokenError } from '../../src/core/token-manager';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AirboltClient', () => {
  let client: AirboltClient;
  let mockTokenManager: TokenManager;
  const baseURL = 'https://api.example.com';
  
  const validChatRequest = {
    messages: [
      { role: 'user' as const, content: 'Hello' },
    ],
  };

  const validChatResponse = {
    content: 'Hello! How can I help you?',
    usage: { total_tokens: 15 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a mock token manager
    mockTokenManager = {
      getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
      clearToken: vi.fn(),
      hasValidToken: vi.fn().mockReturnValue(true),
      getTokenInfo: vi.fn().mockReturnValue({
        hasToken: true,
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
      }),
    } as any;

    client = new AirboltClient({
      baseURL,
      tokenManager: mockTokenManager,
      timeout: 5000,
      maxRetries: 3,
      retryDelay: 100,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('chat', () => {
    it('should successfully send a chat request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(validChatResponse),
      });

      const response = await client.chat(validChatRequest);

      expect(response).toEqual(validChatResponse);
      expect(mockTokenManager.getToken).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}/api/chat`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-jwt-token',
          },
          body: JSON.stringify(validChatRequest),
        })
      );
    });

    it('should include system prompt in request', async () => {
      const requestWithSystem = {
        ...validChatRequest,
        system: 'You are a helpful assistant',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(validChatResponse),
      });

      await client.chat(requestWithSystem);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}/api/chat`,
        expect.objectContaining({
          body: JSON.stringify(requestWithSystem),
        })
      );
    });

    it('should validate request schema', async () => {
      const invalidRequest = {
        messages: [], // Empty messages array
      };

      await expect(client.chat(invalidRequest as any)).rejects.toThrow();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should validate response schema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ invalid: 'response' }),
      });

      await expect(client.chat(validChatRequest)).rejects.toThrow();
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          error: 'Bad Request',
          message: 'Invalid input',
          statusCode: 400,
        }),
      });

      await expect(client.chat(validChatRequest)).rejects.toThrow(AirboltError);
    });

    it('should handle 401 errors with token refresh', async () => {
      // First call fails with 401
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: vi.fn().mockResolvedValue({
            error: 'Unauthorized',
            message: 'Invalid token',
            statusCode: 401,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(validChatResponse),
        });

      const response = await client.chat(validChatRequest);

      expect(response).toEqual(validChatResponse);
      expect(mockTokenManager.clearToken).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on server errors', async () => {
      // First two calls fail with 500
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: vi.fn().mockResolvedValue({
            error: 'Internal Server Error',
            message: 'Server error',
            statusCode: 500,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: vi.fn().mockResolvedValue({
            error: 'Internal Server Error',
            message: 'Server error',
            statusCode: 500,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(validChatResponse),
        });

      const response = await client.chat(validChatRequest);

      expect(response).toEqual(validChatResponse);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on client errors (4xx)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          error: 'Bad Request',
          message: 'Invalid input',
          statusCode: 400,
        }),
      });

      await expect(client.chat(validChatRequest)).rejects.toThrow(AirboltError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    it('should throw after max retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({
          error: 'Internal Server Error',
          message: 'Server error',
          statusCode: 500,
        }),
      });

      await expect(client.chat(validChatRequest)).rejects.toThrow(AirboltError);
      expect(mockFetch).toHaveBeenCalledTimes(3); // maxRetries
    });

    it('should handle request timeout', async () => {
      // Mock a fetch that rejects quickly to simulate timeout
      mockFetch.mockImplementationOnce(() => 
        Promise.reject(new Error('Request timeout'))
      );

      const timeoutClient = new AirboltClient({
        baseURL,
        tokenManager: mockTokenManager,
        timeout: 100, // 100ms timeout
        maxRetries: 1, // Reduce retries for faster test
      });

      await expect(timeoutClient.chat(validChatRequest)).rejects.toThrow(AirboltError);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.chat(validChatRequest)).rejects.toThrow(AirboltError);
    });

    it('should handle token manager errors', async () => {
      mockTokenManager.getToken = vi.fn().mockRejectedValue(new TokenError('Token fetch failed'));

      // The client retries token errors and wraps final error in AirboltError
      await expect(client.chat(validChatRequest)).rejects.toThrow(AirboltError);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('request validation', () => {
    it('should reject empty messages array', async () => {
      const invalidRequest = { messages: [] };

      await expect(client.chat(invalidRequest as any)).rejects.toThrow();
    });

    it('should reject messages with invalid role', async () => {
      const invalidRequest = {
        messages: [{ role: 'invalid', content: 'Hello' }],
      };

      await expect(client.chat(invalidRequest as any)).rejects.toThrow();
    });

    it('should reject messages with empty content', async () => {
      const invalidRequest = {
        messages: [{ role: 'user', content: '' }],
      };

      await expect(client.chat(invalidRequest as any)).rejects.toThrow();
    });

    it('should reject too many messages', async () => {
      const invalidRequest = {
        messages: Array(51).fill({ role: 'user', content: 'Hello' }),
      };

      await expect(client.chat(invalidRequest as any)).rejects.toThrow();
    });

    it('should accept valid message roles', async () => {
      const validRoles = ['user', 'assistant', 'system'] as const;
      
      for (const role of validRoles) {
        const request = {
          messages: [{ role, content: 'Test message' }],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(validChatResponse),
        });

        await expect(client.chat(request)).resolves.toEqual(validChatResponse);
      }
    });
  });

  describe('utility methods', () => {
    it('should return base URL', () => {
      expect(client.getBaseURL()).toBe(baseURL);
    });

    it('should return token info', () => {
      const tokenInfo = client.getTokenInfo();
      expect(tokenInfo).toEqual({
        hasToken: true,
        expiresAt: expect.any(Date),
        tokenType: 'Bearer',
      });
      expect(mockTokenManager.getTokenInfo).toHaveBeenCalled();
    });

    it('should clear token', () => {
      client.clearToken();
      expect(mockTokenManager.clearToken).toHaveBeenCalled();
    });

    it('should check if has valid token', () => {
      const hasToken = client.hasValidToken();
      expect(hasToken).toBe(true);
      expect(mockTokenManager.hasValidToken).toHaveBeenCalled();
    });
  });

  describe('error handling edge cases', () => {
    it('should handle malformed error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      await expect(client.chat(validChatRequest)).rejects.toThrow(AirboltError);
    });

    it('should handle missing fetch implementation', async () => {
      // Temporarily remove fetch
      const originalFetch = global.fetch;
      delete (global as any).fetch;
      // Only try to delete window.fetch if window exists (browser environment)
      if (typeof window !== 'undefined') {
        delete (window as any).fetch;
      }

      const clientWithoutFetch = new AirboltClient({
        baseURL,
        tokenManager: mockTokenManager,
      });

      await expect(clientWithoutFetch.chat(validChatRequest))
        .rejects.toThrow(AirboltError);

      // Restore fetch
      global.fetch = originalFetch;
    });

    it('should handle response without content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ usage: { total_tokens: 10 } }),
      });

      await expect(client.chat(validChatRequest)).rejects.toThrow();
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple concurrent requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(validChatResponse),
      });

      const promises = [
        client.chat(validChatRequest),
        client.chat(validChatRequest),
        client.chat(validChatRequest),
      ];

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(3);
      responses.forEach(response => {
        expect(response).toEqual(validChatResponse);
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockTokenManager.getToken).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure requests', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(validChatResponse),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: vi.fn().mockResolvedValue({
            error: 'Bad Request',
            message: 'Invalid input',
            statusCode: 400,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(validChatResponse),
        });

      const promises = [
        client.chat(validChatRequest),
        client.chat(validChatRequest),
        client.chat(validChatRequest),
      ];

      const results = await Promise.allSettled(promises);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });
});