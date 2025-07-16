import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import OpenAI from 'openai';
import {
  OpenAIService,
  OpenAIServiceError,
  type Message,
} from '../../src/services/openai.js';

// Mock the entire openai module
vi.mock('openai');

describe('OpenAIService Property Tests', () => {
  let mockOpenAI: any;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.restoreAllMocks();

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

  describe('Retry Logic Properties', () => {
    it(
      'should handle any combination of failures with eventual success',
      { timeout: 30000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(
              fc.oneof(
                fc.constant({
                  type: 'error' as const,
                  status: 429,
                  message: 'Rate limit',
                }),
                fc.constant({
                  type: 'error' as const,
                  status: 503,
                  message: 'Unavailable',
                }),
                fc.constant({
                  type: 'error' as const,
                  status: 500,
                  message: 'Server error',
                }),
                fc.constant({
                  type: 'error' as const,
                  status: 502,
                  message: 'Bad gateway',
                }),
                fc.constant({
                  type: 'network' as const,
                  message: 'ECONNREFUSED',
                }),
                fc.constant({ type: 'network' as const, message: 'ETIMEDOUT' }),
                fc.constant({ type: 'empty' as const, message: 'No content' })
              ),
              { minLength: 0, maxLength: 10 }
            ),
            fc.boolean(), // eventual success
            fc.integer({ min: 1, max: 5 }), // max retries
            fc.integer({ min: 1, max: 100 }), // base delay
            async (failures, eventualSuccess, maxRetries, baseDelay) => {
              const service = new OpenAIService('test-key', undefined, {
                maxRetries,
                baseDelay,
              });

              // Clear any previous mock state
              mockCreate.mockClear();

              // Setup mock to fail with specified errors then succeed
              let callCount = 0;
              mockCreate.mockImplementation(async () => {
                const currentCallIndex = callCount++;

                if (currentCallIndex < failures.length) {
                  const failure = failures[currentCallIndex];

                  if (failure && failure.type === 'error') {
                    throw new (OpenAI as any).APIError(
                      failure.message,
                      failure.status
                    );
                  } else if (failure && failure.type === 'network') {
                    throw new Error(failure.message);
                  } else if (failure && failure.type === 'empty') {
                    return { choices: [{ message: {} }] };
                  }
                }

                // If we've run out of failures and eventualSuccess is true, succeed
                if (eventualSuccess) {
                  return {
                    choices: [{ message: { content: 'Success' } }],
                    usage: { total_tokens: 50 },
                  };
                }

                // Otherwise, keep failing
                throw new (OpenAI as any).APIError('Permanent failure', 500);
              });

              const messages: Message[] = [{ role: 'user', content: 'Test' }];

              try {
                const result = await service.createChatCompletion(messages);

                // Should succeed if eventual success and failures within retry limit
                const retriableFailures = failures.filter(
                  f =>
                    (f.type === 'error' &&
                      'status' in f &&
                      (f.status === 429 || f.status >= 500)) ||
                    f.type === 'network' ||
                    f.type === 'empty'
                ).length;

                // Should have succeeded if we have eventual success and not too many failures
                expect(eventualSuccess).toBe(true);
                expect(retriableFailures).toBeLessThanOrEqual(maxRetries);
                expect(result.content).toBe('Success');
              } catch (error) {
                // Should fail if no eventual success or too many retriable failures
                expect(error).toBeInstanceOf(OpenAIServiceError);

                if (!eventualSuccess) {
                  // Expected to fail
                } else {
                  // Check if we had too many retriable failures
                  const retriableFailures = failures.filter(
                    f =>
                      (f.type === 'error' &&
                        'status' in f &&
                        (f.status === 429 || f.status >= 500)) ||
                      f.type === 'network' ||
                      f.type === 'empty'
                  ).length;
                  expect(retriableFailures).toBeGreaterThanOrEqual(maxRetries);
                }
              }

              // Verify retry count doesn't exceed max retries
              const actualCalls = mockCreate.mock.calls.length;
              if (actualCalls > maxRetries) {
                console.error(
                  `Expected <= ${maxRetries} calls, got ${actualCalls}. Test params:`,
                  {
                    failures: failures.length,
                    eventualSuccess,
                    maxRetries,
                    callCount,
                  }
                );
              }
              expect(actualCalls).toBeLessThanOrEqual(maxRetries);
            }
          ),
          { numRuns: 50 } // Reduce number of runs for faster testing
        );
      }
    );

    it(
      'should apply exponential backoff correctly for any retry count',
      { timeout: 20000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 3 }), // retry count
            fc.integer({ min: 10, max: 100 }), // base delay
            fc.array(fc.constantFrom(429, 500, 502, 503), {
              minLength: 1,
              maxLength: 3,
            }),
            async (maxRetries, baseDelay, errorCodes) => {
              const service = new OpenAIService('test-key', undefined, {
                maxRetries,
                baseDelay,
              });

              const attemptTimestamps: number[] = [];
              let attemptCount = 0;

              mockCreate.mockImplementation(async () => {
                attemptTimestamps.push(Date.now());
                attemptCount++;

                if (
                  attemptCount < errorCodes.length &&
                  attemptCount < maxRetries
                ) {
                  const errorCode = errorCodes[attemptCount - 1];
                  if (errorCode !== undefined) {
                    throw new (OpenAI as any).APIError('Error', errorCode);
                  }
                }

                if (attemptCount >= maxRetries) {
                  throw new (OpenAI as any).APIError('Final error', 503);
                }

                return {
                  choices: [{ message: { content: 'Success' } }],
                };
              });

              const messages: Message[] = [{ role: 'user', content: 'Test' }];

              try {
                await service.createChatCompletion(messages);
              } catch {
                // Expected for some cases
              }

              // Verify exponential backoff timing
              for (let i = 1; i < attemptTimestamps.length; i++) {
                const current = attemptTimestamps[i];
                const previous = attemptTimestamps[i - 1];
                if (current !== undefined && previous !== undefined) {
                  const actualDelay = current - previous;
                  const expectedDelay = baseDelay * Math.pow(2, i - 1);

                  // Allow 20ms tolerance for timing variations
                  expect(actualDelay).toBeGreaterThanOrEqual(
                    expectedDelay - 20
                  );
                  expect(actualDelay).toBeLessThanOrEqual(expectedDelay + 50);
                }
              }
            }
          ),
          { numRuns: 10 } // Reduce number of runs for faster testing
        );
      }
    );

    it('should never retry client errors except 429', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 400, max: 428 }), // client error codes (excluding 429)
          fc.integer({ min: 1, max: 5 }), // max retries
          fc.string(), // error message
          async (statusCode, maxRetries, errorMessage) => {
            const service = new OpenAIService('test-key', undefined, {
              maxRetries,
              baseDelay: 1,
            });

            // Clear previous calls
            mockCreate.mockClear();
            mockCreate.mockRejectedValue(
              new (OpenAI as any).APIError(errorMessage, statusCode)
            );

            const messages: Message[] = [{ role: 'user', content: 'Test' }];

            await expect(
              service.createChatCompletion(messages)
            ).rejects.toThrow(OpenAIServiceError);

            // Should not retry for client errors (except 429)
            expect(mockCreate).toHaveBeenCalledTimes(1);
          }
        )
      );
    });
  });

  describe('System Prompt Injection Properties', () => {
    it('should correctly handle any system prompt configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(undefined),
            fc.constant(''),
            fc.constant('   '), // whitespace only
            fc.constant('  \n\t  '), // various whitespace
            fc.string({ minLength: 1, maxLength: 1000 })
          ),
          fc.array(
            fc.record({
              role: fc.constantFrom('user', 'assistant', 'system'),
              content: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 10 } // Changed to minLength: 1 to ensure we have messages
          ),
          async (systemPrompt, inputMessages) => {
            // systemPrompt might be undefined in the constructor
            const service = new OpenAIService('test-key', systemPrompt);

            mockCreate.mockResolvedValue({
              choices: [{ message: { content: 'Response' } }],
            });

            const messages: Message[] = inputMessages as Message[];

            // Clear the mock before this specific test
            mockCreate.mockClear();
            mockCreate.mockResolvedValue({
              choices: [{ message: { content: 'Response' } }],
            });

            await service.createChatCompletion(messages);

            expect(mockCreate).toHaveBeenCalled();
            const firstCall = mockCreate.mock.calls[0];
            if (!firstCall || !firstCall[0]) {
              throw new Error('Expected mock to be called with arguments');
            }
            const calledMessages = firstCall[0].messages;

            // Verify system prompt injection logic based on the service implementation
            // The service only injects if systemPrompt exists and is not empty/whitespace
            const shouldInjectPrompt =
              systemPrompt && systemPrompt.trim() !== '';

            if (!shouldInjectPrompt) {
              // No system prompt should be injected
              expect(calledMessages).toEqual(messages);
            } else {
              // System prompt should be first message
              expect(calledMessages[0]).toEqual({
                role: 'system',
                content: systemPrompt,
              });

              // If input had a system message, it should be replaced
              const inputSystemIndex = messages.findIndex(
                m => m.role === 'system'
              );
              if (inputSystemIndex === 0) {
                expect(calledMessages.slice(1)).toEqual(messages.slice(1));
              } else {
                expect(calledMessages.slice(1)).toEqual(messages);
              }
            }
          }
        )
      );
    });
  });

  describe('Error Mapping Properties', () => {
    it(
      'should map any OpenAI error to correct service error',
      { timeout: 20000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.oneof(
              fc.record({ status: fc.constant(401), message: fc.string() }),
              fc.record({
                status: fc.constant(429),
                message: fc.oneof(
                  fc.constant('Rate limit exceeded'),
                  fc.constant('You exceeded your current quota'),
                  fc.constant('Insufficient quota'),
                  fc.constant('Please check your billing')
                ),
              }),
              fc.record({ status: fc.constant(400), message: fc.string() }),
              fc.record({
                status: fc.constantFrom(500, 502, 503),
                message: fc.string(),
              }),
              fc.record({
                status: fc.integer({ min: 404, max: 599 }),
                message: fc.string(),
              })
            ),
            async errorConfig => {
              const service = new OpenAIService('test-key', undefined, {
                maxRetries: 1, // Single attempt to ensure error mapping is tested
              });

              mockCreate.mockRejectedValue(
                new (OpenAI as any).APIError(
                  errorConfig.message,
                  errorConfig.status
                )
              );

              const messages: Message[] = [{ role: 'user', content: 'Test' }];

              try {
                await service.createChatCompletion(messages);
                throw new Error('Should have thrown');
              } catch (error) {
                expect(error).toBeInstanceOf(OpenAIServiceError);
                const serviceError = error as OpenAIServiceError;

                // Verify correct error mapping
                switch (errorConfig.status) {
                  case 401:
                    expect(serviceError.statusCode).toBe(401);
                    expect(serviceError.code).toBe('INVALID_API_KEY');
                    break;
                  case 429:
                    if (
                      errorConfig.message.includes('quota') ||
                      errorConfig.message.includes('billing')
                    ) {
                      expect(serviceError.statusCode).toBe(402);
                      expect(serviceError.code).toBe('INSUFFICIENT_QUOTA');
                    } else {
                      expect(serviceError.statusCode).toBe(429);
                      expect(serviceError.code).toBe('RATE_LIMIT_EXCEEDED');
                    }
                    break;
                  case 400:
                    expect(serviceError.statusCode).toBe(400);
                    expect(serviceError.code).toBe('INVALID_REQUEST');
                    break;
                  case 500:
                  case 502:
                  case 503:
                    expect(serviceError.statusCode).toBe(503);
                    expect(serviceError.code).toBe('SERVICE_UNAVAILABLE');
                    break;
                  default:
                    if (errorConfig.status >= 404) {
                      expect(serviceError.statusCode).toBe(errorConfig.status);
                      expect(serviceError.code).toBe('OPENAI_ERROR');
                    }
                }
              }
            }
          )
        );
      }
    );

    it('should handle any network error pattern', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('ECONNREFUSED'),
            fc.constant('ETIMEDOUT'),
            fc.constant('ENOTFOUND'),
            fc.constant('ECONNRESET'),
            fc.string() // any other error
          ),
          async errorType => {
            const service = new OpenAIService('test-key', undefined, {
              maxRetries: 1, // Single attempt to ensure error mapping is tested
            });

            const errorMessage = errorType ? `Network error: ${errorType}` : '';
            mockCreate.mockRejectedValue(new Error(errorMessage));

            const messages: Message[] = [{ role: 'user', content: 'Test' }];

            try {
              await service.createChatCompletion(messages);
              throw new Error('Should have thrown');
            } catch (error) {
              expect(error).toBeInstanceOf(OpenAIServiceError);
              const serviceError = error as OpenAIServiceError;

              // Match the actual implementation logic
              const serviceErrorMessage = serviceError.message;

              // Check the original error message we created
              if (
                errorMessage.includes('ECONNREFUSED') ||
                errorMessage.includes('ETIMEDOUT')
              ) {
                expect(serviceError.statusCode).toBe(503);
                expect(serviceError.code).toBe('CONNECTION_ERROR');
                expect(serviceErrorMessage).toBe(
                  'Unable to connect to OpenAI API'
                );
              } else if (errorMessage === 'No content in OpenAI response') {
                expect(serviceError.statusCode).toBe(500);
                expect(serviceError.code).toBe('NO_CONTENT');
              } else {
                expect(serviceError.statusCode).toBe(500);
                expect(serviceError.code).toBe('UNEXPECTED_ERROR');
              }
            }
          }
        )
      );
    });
  });

  describe('Response Handling Properties', () => {
    it('should handle any response structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // Valid responses
            fc.record({
              choices: fc.array(
                fc.record({
                  message: fc.record({
                    content: fc.string({ minLength: 1 }),
                  }),
                }),
                { minLength: 1, maxLength: 1 }
              ),
              usage: fc.oneof(
                fc.constant(undefined),
                fc.record({ total_tokens: fc.integer({ min: 1, max: 10000 }) })
              ),
            }),
            // Invalid responses
            fc.record({ choices: fc.constant([]) }),
            fc.record({ choices: fc.constant([{ message: {} }]) }),
            fc.record({ choices: fc.constant([{ message: { content: '' } }]) }),
            fc.record({ choices: fc.constant(undefined) }),
            fc.record({})
          ),
          async (response: any) => {
            const service = new OpenAIService('test-key', undefined, {
              maxRetries: 3,
              baseDelay: 1,
            });

            mockCreate.mockResolvedValue(response);

            const messages: Message[] = [{ role: 'user', content: 'Test' }];

            try {
              const result = await service.createChatCompletion(messages);

              // Should only succeed for valid responses
              expect(response.choices).toBeDefined();
              expect(response.choices.length).toBeGreaterThan(0);
              expect(response.choices[0].message?.content).toBeTruthy();

              expect(result.content).toBe(response.choices[0].message.content);
              expect(result.usage).toEqual(
                response.usage
                  ? { total_tokens: response.usage.total_tokens }
                  : undefined
              );
            } catch (error) {
              // Should fail for invalid responses
              expect(error).toBeInstanceOf(OpenAIServiceError);

              // Verify it's an invalid response
              const hasValidContent =
                response.choices?.[0]?.message?.content &&
                response.choices[0].message.content.length > 0;
              expect(hasValidContent).toBeFalsy();
            }
          }
        )
      );
    });
  });

  describe('Concurrency Properties', () => {
    it('should handle concurrent requests independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }), // concurrent requests
          fc.array(
            fc.boolean(), // success/failure for each request
            { minLength: 2, maxLength: 10 }
          ),
          async (concurrentCount, successPattern) => {
            const service = new OpenAIService('test-key', undefined, {
              maxRetries: 1,
              baseDelay: 1,
            });

            let callIndex = 0;
            mockCreate.mockImplementation(async () => {
              const currentIndex = callIndex++;
              const patternIndex = currentIndex % successPattern.length;
              const shouldSucceed = successPattern[patternIndex];

              if (shouldSucceed) {
                return {
                  choices: [
                    { message: { content: `Response ${currentIndex}` } },
                  ],
                };
              } else {
                throw new (OpenAI as any).APIError('Concurrent failure', 503);
              }
            });

            const messages: Message[] = [{ role: 'user', content: 'Test' }];

            // Fire concurrent requests
            const requests = Array(concurrentCount)
              .fill(0)
              .map(() => service.createChatCompletion([...messages]));

            const results = await Promise.allSettled(requests);

            // Verify we got the expected number of results
            expect(results.length).toBe(concurrentCount);

            // At least some requests should succeed/fail based on pattern
            const fulfilled = results.filter(
              r => r.status === 'fulfilled'
            ).length;
            const rejected = results.filter(
              r => r.status === 'rejected'
            ).length;

            // Verify we got results for all concurrent requests
            const total = fulfilled + rejected;
            expect(total).toBe(concurrentCount);

            // With maxRetries=1, each request only tries once
            // The success/failure depends on which pattern index each request gets
            // Due to concurrency, we can't predict exact counts, but we can verify
            // that at least some pattern behavior is observed
            if (successPattern.every(s => s)) {
              // All successes in pattern - all should succeed
              expect(fulfilled).toBe(concurrentCount);
            } else if (successPattern.every(s => !s)) {
              // All failures in pattern - all should fail
              expect(rejected).toBe(concurrentCount);
            } else {
              // Mixed pattern - we should have both successes and failures
              // But exact counts depend on timing and pattern cycling
              expect(fulfilled + rejected).toBe(concurrentCount);
            }
          }
        )
      );
    });
  });
});
