import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OpenAI from 'openai';
import {
  OpenAIService,
  OpenAIServiceError,
  type Message,
} from '../../src/services/openai.js';

// Mock the entire openai module
vi.mock('openai');

describe('OpenAIService', () => {
  let service: OpenAIService;
  let mockOpenAI: any;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Create mock functions
    mockCreate = vi.fn();

    // Create mock OpenAI instance
    mockOpenAI = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };

    // Mock the OpenAI constructor to return our mock instance
    vi.mocked(OpenAI).mockImplementation(() => mockOpenAI);

    // Add APIError as a static property on the mocked constructor
    (OpenAI as any).APIError = class APIError extends Error {
      constructor(
        message: string,
        public status: number,
        public code?: string
      ) {
        super(message);
        this.name = 'APIError';
      }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create service with default options', () => {
      service = new OpenAIService('test-api-key');
      expect(service).toBeInstanceOf(OpenAIService);
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });

    it('should create service with system prompt', () => {
      service = new OpenAIService(
        'test-api-key',
        'You are a helpful assistant'
      );
      expect(service).toBeInstanceOf(OpenAIService);
    });

    it('should create service with custom options', () => {
      service = new OpenAIService('test-api-key', undefined, {
        model: 'gpt-4',
        maxRetries: 5,
        baseDelay: 2000,
      });
      expect(service).toBeInstanceOf(OpenAIService);
    });
  });

  describe('createChatCompletion', () => {
    beforeEach(() => {
      service = new OpenAIService(
        'test-api-key',
        'You are a helpful assistant'
      );
    });

    it('should successfully create chat completion', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Hello! How can I help you today?',
            },
          },
        ],
        usage: {
          total_tokens: 50,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      const result = await service.createChatCompletion(messages);

      expect(result).toEqual({
        content: 'Hello! How can I help you today?',
        usage: {
          total_tokens: 50,
        },
      });

      // Verify system prompt was injected
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello' },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });
    });

    it('should handle response without usage data', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Response without usage',
            },
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      const result = await service.createChatCompletion(messages);

      expect(result).toEqual({
        content: 'Response without usage',
        usage: undefined,
      });
    });

    it('should replace existing system message with configured one', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Response',
            },
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const messages: Message[] = [
        { role: 'system', content: 'Old system prompt' },
        { role: 'user', content: 'Hello' },
      ];

      await service.createChatCompletion(messages);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'Hello' },
          ],
        })
      );
    });

    it('should not inject system prompt if none configured', async () => {
      service = new OpenAIService('test-api-key'); // No system prompt

      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Response',
            },
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      await service.createChatCompletion(messages);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Hello' }],
        })
      );
    });

    it('should throw error when response has no content', async () => {
      const mockResponse = {
        choices: [
          {
            message: {},
          },
        ],
      };

      // Mock all retry attempts to return the same response
      mockCreate.mockResolvedValue(mockResponse);

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      // The service will retry and eventually throw a generic error
      await expect(service.createChatCompletion(messages)).rejects.toThrow(
        OpenAIServiceError
      );

      // Verify it attempted retries
      expect(mockCreate).toHaveBeenCalledTimes(3); // Default max retries
    });

    describe('error handling', () => {
      it('should handle 401 unauthorized error', async () => {
        const error = new (OpenAI as any).APIError('Unauthorized', 401);
        mockCreate.mockRejectedValueOnce(error);

        const messages: Message[] = [{ role: 'user', content: 'Test' }];

        await expect(service.createChatCompletion(messages)).rejects.toThrow(
          new OpenAIServiceError(
            'Invalid OpenAI API key',
            401,
            'INVALID_API_KEY'
          )
        );
      });

      it('should handle 429 rate limit error with retries', async () => {
        const error = new (OpenAI as any).APIError('Rate limit exceeded', 429);
        const mockResponse = {
          choices: [
            {
              message: {
                content: 'Success after retry',
              },
            },
          ],
        };

        // Fail twice, succeed on third try
        mockCreate
          .mockRejectedValueOnce(error)
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(mockResponse);

        // Use shorter delays for testing
        service = new OpenAIService('test-api-key', undefined, {
          maxRetries: 3,
          baseDelay: 10,
        });

        const messages: Message[] = [{ role: 'user', content: 'Test' }];

        const result = await service.createChatCompletion(messages);

        expect(result.content).toBe('Success after retry');
        expect(mockCreate).toHaveBeenCalledTimes(3);
      });

      it('should throw rate limit error after max retries', async () => {
        const error = new (OpenAI as any).APIError('Rate limit exceeded', 429);

        mockCreate.mockRejectedValue(error);

        service = new OpenAIService('test-api-key', undefined, {
          maxRetries: 2,
          baseDelay: 10,
        });

        const messages: Message[] = [{ role: 'user', content: 'Test' }];

        await expect(service.createChatCompletion(messages)).rejects.toThrow(
          new OpenAIServiceError(
            'Rate limit exceeded. Please try again later.',
            429,
            'RATE_LIMIT_EXCEEDED'
          )
        );

        expect(mockCreate).toHaveBeenCalledTimes(2);
      });

      it('should handle 400 bad request error', async () => {
        const error = new (OpenAI as any).APIError('Bad request', 400);
        mockCreate.mockRejectedValueOnce(error);

        const messages: Message[] = [{ role: 'user', content: 'Test' }];

        await expect(service.createChatCompletion(messages)).rejects.toThrow(
          new OpenAIServiceError(
            'Invalid request to OpenAI API',
            400,
            'INVALID_REQUEST'
          )
        );
      });

      it('should handle 503 service unavailable error', async () => {
        const error = new (OpenAI as any).APIError('Service unavailable', 503);
        // Service will retry 503 errors, so mock all attempts
        mockCreate.mockRejectedValue(error);

        const messages: Message[] = [{ role: 'user', content: 'Test' }];

        // After retries are exhausted, it will throw the service unavailable error
        await expect(service.createChatCompletion(messages)).rejects.toThrow(
          new OpenAIServiceError(
            'OpenAI service temporarily unavailable',
            503,
            'SERVICE_UNAVAILABLE'
          )
        );
      });

      it('should handle network connection errors', async () => {
        const error = new Error('connect ECONNREFUSED 127.0.0.1:443');
        // Network errors get retried
        mockCreate.mockRejectedValue(error);

        const messages: Message[] = [{ role: 'user', content: 'Test' }];

        await expect(service.createChatCompletion(messages)).rejects.toThrow(
          new OpenAIServiceError(
            'Unable to connect to OpenAI API',
            503,
            'CONNECTION_ERROR'
          )
        );
      });

      it('should handle timeout errors', async () => {
        const error = new Error('Request timeout: ETIMEDOUT');
        // Timeout errors get retried
        mockCreate.mockRejectedValue(error);

        const messages: Message[] = [{ role: 'user', content: 'Test' }];

        await expect(service.createChatCompletion(messages)).rejects.toThrow(
          new OpenAIServiceError(
            'Unable to connect to OpenAI API',
            503,
            'CONNECTION_ERROR'
          )
        );
      });

      it('should handle unexpected errors', async () => {
        const error = new Error('Something unexpected happened');
        mockCreate.mockRejectedValueOnce(error);

        const messages: Message[] = [{ role: 'user', content: 'Test' }];

        await expect(service.createChatCompletion(messages)).rejects.toThrow(
          new OpenAIServiceError(
            'Unexpected error communicating with OpenAI',
            500,
            'UNEXPECTED_ERROR'
          )
        );
      });

      it('should handle unknown errors', async () => {
        // Unknown errors get retried
        mockCreate.mockRejectedValue('not an error object');

        const messages: Message[] = [{ role: 'user', content: 'Test' }];

        await expect(service.createChatCompletion(messages)).rejects.toThrow(
          new OpenAIServiceError('Unknown error occurred', 500, 'UNKNOWN_ERROR')
        );
      });
    });

    describe('retry logic', () => {
      it('should retry on 500 errors', async () => {
        const error = new (OpenAI as any).APIError(
          'Internal server error',
          500
        );
        const mockResponse = {
          choices: [
            {
              message: {
                content: 'Success after retry',
              },
            },
          ],
        };

        mockCreate
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(mockResponse);

        service = new OpenAIService('test-api-key', undefined, {
          maxRetries: 2,
          baseDelay: 10,
        });

        const messages: Message[] = [{ role: 'user', content: 'Test' }];

        const result = await service.createChatCompletion(messages);

        expect(result.content).toBe('Success after retry');
        expect(mockCreate).toHaveBeenCalledTimes(2);
      });

      it('should not retry on 400 client errors', async () => {
        const error = new (OpenAI as any).APIError('Bad request', 400);

        mockCreate.mockRejectedValueOnce(error);

        service = new OpenAIService('test-api-key', undefined, {
          maxRetries: 3,
          baseDelay: 10,
        });

        const messages: Message[] = [{ role: 'user', content: 'Test' }];

        await expect(service.createChatCompletion(messages)).rejects.toThrow();

        // Should not retry for client errors
        expect(mockCreate).toHaveBeenCalledTimes(1);
      });

      it('should use exponential backoff for retries', async () => {
        const error = new (OpenAI as any).APIError('Server error', 500);

        mockCreate.mockRejectedValue(error);

        service = new OpenAIService('test-api-key', undefined, {
          maxRetries: 3,
          baseDelay: 10,
        });

        const startTime = Date.now();
        const messages: Message[] = [{ role: 'user', content: 'Test' }];

        await expect(service.createChatCompletion(messages)).rejects.toThrow();

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        // Should have delays of 10ms, 20ms (total 30ms minimum)
        expect(totalTime).toBeGreaterThanOrEqual(25); // Allow some margin
        expect(mockCreate).toHaveBeenCalledTimes(3);
      });
    });
  });
});
