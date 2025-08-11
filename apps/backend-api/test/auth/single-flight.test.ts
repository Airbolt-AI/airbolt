import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import {
  SingleFlight,
  createHashKey,
  jwtSingleFlight,
} from '../../src/auth/single-flight.js';

describe('SingleFlight', () => {
  let singleFlight: SingleFlight<string>;

  beforeEach(() => {
    singleFlight = new SingleFlight();
  });

  describe('basic functionality', () => {
    it('should execute function and return result', async () => {
      const result = await singleFlight.do('test-key', async () => 'result');
      expect(result).toBe('result');
    });

    it('should coalesce concurrent calls with same key', async () => {
      const mockFn = vi.fn().mockResolvedValue('result');

      const promises = Array(5)
        .fill(0)
        .map(() => singleFlight.do('same-key', mockFn));

      const results = await Promise.all(promises);

      // All should get the same result
      expect(results).toEqual([
        'result',
        'result',
        'result',
        'result',
        'result',
      ]);

      // Function should only be called once
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should not coalesce calls with different keys', async () => {
      const mockFn1 = vi.fn().mockResolvedValue('result1');
      const mockFn2 = vi.fn().mockResolvedValue('result2');

      const [result1, result2] = await Promise.all([
        singleFlight.do('key1', mockFn1),
        singleFlight.do('key2', mockFn2),
      ]);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(mockFn1).toHaveBeenCalledTimes(1);
      expect(mockFn2).toHaveBeenCalledTimes(1);
    });

    it('should clean up after successful completion', async () => {
      const mockFn = vi.fn().mockResolvedValue('result');

      await singleFlight.do('test-key', mockFn);

      // Should be cleaned up
      expect(singleFlight.stats().inFlightCount).toBe(0);

      // Second call should trigger function again
      await singleFlight.do('test-key', mockFn);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should propagate errors to all waiting callers', async () => {
      const error = new Error('Test error');
      const mockFn = vi.fn().mockRejectedValue(error);

      const promises = Array(3)
        .fill(0)
        .map(() => singleFlight.do('error-key', mockFn));

      const results = await Promise.allSettled(promises);

      // All should be rejected with same error
      for (const result of results) {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(result.reason).toBe(error);
        }
      }

      // Function should only be called once
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should clean up after error', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(singleFlight.do('error-key', mockFn)).rejects.toThrow(
        'Test error'
      );

      // Should be cleaned up
      expect(singleFlight.stats().inFlightCount).toBe(0);

      // Second call should trigger function again
      await expect(singleFlight.do('error-key', mockFn)).rejects.toThrow(
        'Test error'
      );
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and error scenarios', async () => {
      const successFn = vi.fn().mockResolvedValue('success');
      const errorFn = vi.fn().mockRejectedValue(new Error('error'));

      const [successResult, errorResult] = await Promise.allSettled([
        singleFlight.do('success-key', successFn),
        singleFlight.do('error-key', errorFn),
      ]);

      expect(successResult.status).toBe('fulfilled');
      if (successResult.status === 'fulfilled') {
        expect(successResult.value).toBe('success');
      }

      expect(errorResult.status).toBe('rejected');
      if (errorResult.status === 'rejected') {
        expect(errorResult.reason.message).toBe('error');
      }
    });
  });

  describe('manual control', () => {
    it('should allow manual forgetting of keys', async () => {
      const slowFn = vi
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve('slow'), 100))
        );

      // Start a slow operation
      const promise1 = singleFlight.do('slow-key', slowFn);

      // Verify it's in flight
      expect(singleFlight.stats().inFlightCount).toBe(1);
      expect(singleFlight.stats().keys).toContain('slow-key');

      // Forget the key
      singleFlight.forget('slow-key');

      // Should be removed from tracking
      expect(singleFlight.stats().inFlightCount).toBe(0);

      // Original promise should still complete
      await expect(promise1).resolves.toBe('slow');

      // New call should start fresh
      const promise2 = singleFlight.do('slow-key', slowFn);
      await expect(promise2).resolves.toBe('slow');

      expect(slowFn).toHaveBeenCalledTimes(2);
    });

    it('should allow clearing all inflight operations', async () => {
      const slowFn = vi
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve('slow'), 100))
        );

      // Start multiple operations
      const promise1 = singleFlight.do('key1', slowFn);
      const promise2 = singleFlight.do('key2', slowFn);

      expect(singleFlight.stats().inFlightCount).toBe(2);

      // Clear all
      singleFlight.clear();

      expect(singleFlight.stats().inFlightCount).toBe(0);
      expect(singleFlight.stats().keys).toEqual([]);

      // Original promises should still complete
      await expect(promise1).resolves.toBe('slow');
      await expect(promise2).resolves.toBe('slow');
    });
  });

  describe('stats and monitoring', () => {
    it('should provide accurate stats', async () => {
      expect(singleFlight.stats()).toEqual({
        inFlightCount: 0,
        keys: [],
      });

      const slowFn = vi
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve('slow'), 50))
        );

      // Start operations
      const promise1 = singleFlight.do('key1', slowFn);
      const promise2 = singleFlight.do('key2', slowFn);

      const stats = singleFlight.stats();
      expect(stats.inFlightCount).toBe(2);
      expect(stats.keys).toHaveLength(2);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');

      await Promise.all([promise1, promise2]);

      expect(singleFlight.stats().inFlightCount).toBe(0);
    });
  });

  describe('property-based testing', () => {
    it('should handle arbitrary concurrent operations correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              key: fc.string({ minLength: 1, maxLength: 10 }),
              delay: fc.integer({ min: 0, max: 50 }),
              shouldError: fc.boolean(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async operations => {
            // Track function calls per key
            const functions = new Map<
              string,
              ReturnType<typeof vi.fn<() => Promise<any>>>
            >();

            for (const op of operations) {
              if (!functions.has(op.key)) {
                functions.set(
                  op.key,
                  vi.fn().mockImplementation(async () => {
                    await new Promise(resolve => setTimeout(resolve, op.delay));
                    if (op.shouldError) {
                      throw new Error(`Error for ${op.key}`);
                    }
                    return `result-${op.key}`;
                  })
                );
              }
            }

            // Execute all operations concurrently
            const promises = operations.map(async op => {
              const fn = functions.get(op.key)!;
              try {
                const result = await singleFlight.do(op.key, fn);
                return { key: op.key, success: true, result };
              } catch (error) {
                return { key: op.key, success: false, error };
              }
            });

            const outcomes = await Promise.all(promises);

            // Verify coalescing worked - each unique key should have been called at most once
            for (const [, fn] of functions) {
              expect(fn).toHaveBeenCalledTimes(1);
            }

            // Verify all operations for the same key got the same outcome
            const outcomesByKey = new Map<string, typeof outcomes>();
            for (const outcome of outcomes) {
              if (!outcomesByKey.has(outcome.key)) {
                outcomesByKey.set(outcome.key, []);
              }
              outcomesByKey.get(outcome.key)!.push(outcome);
            }

            for (const [, keyOutcomes] of outcomesByKey) {
              // All outcomes for the same key should have the same success/error status
              const firstOutcome = keyOutcomes[0]!;
              for (const outcome of keyOutcomes) {
                expect(outcome.success).toBe(firstOutcome.success);
                if (outcome.success && firstOutcome.success) {
                  expect(outcome.result).toBe(firstOutcome.result);
                }
              }
            }

            // Should be no inflight operations after completion
            expect(singleFlight.stats().inFlightCount).toBe(0);
          }
        ),
        { numRuns: 50 } // Reduce runs for faster testing
      );
    });

    it('should coalesce high concurrency correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          async (concurrency, delay) => {
            const mockFn = vi.fn().mockImplementation(async () => {
              await new Promise(resolve => setTimeout(resolve, delay));
              return 'result';
            });

            const promises = Array(concurrency)
              .fill(0)
              .map(() => singleFlight.do('high-concurrency', mockFn));

            const results = await Promise.all(promises);

            // All should get same result
            expect(results).toEqual(Array(concurrency).fill('result'));

            // Function called only once
            expect(mockFn).toHaveBeenCalledTimes(1);

            // No inflight operations
            expect(singleFlight.stats().inFlightCount).toBe(0);
          }
        ),
        { numRuns: 20 } // Fewer runs due to high concurrency
      );
    });
  });
});

describe('createHashKey', () => {
  it('should create consistent hashes', () => {
    const input = 'test-input';
    const hash1 = createHashKey(input);
    const hash2 = createHashKey(input);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it('should create different hashes for different inputs', () => {
    const hash1 = createHashKey('input1');
    const hash2 = createHashKey('input2');

    expect(hash1).not.toBe(hash2);
  });

  it('should handle arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), input => {
        const hash = createHashKey(input);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);

        // Same input should produce same hash
        expect(createHashKey(input)).toBe(hash);
      }),
      { numRuns: 100 }
    );
  });
});

describe('global instances', () => {
  it('should provide working JWT single flight instance', async () => {
    const mockFn = vi.fn().mockResolvedValue('jwt-result');

    const result = await jwtSingleFlight.do('test-jwt', mockFn);
    expect(result).toBe('jwt-result');
  });

  it('should maintain separate state for different instances', async () => {
    const instance1 = new SingleFlight<string>();
    const instance2 = new SingleFlight<string>();

    const mockFn = vi.fn().mockResolvedValue('result');

    await Promise.all([
      instance1.do('same-key', mockFn),
      instance2.do('same-key', mockFn),
    ]);

    // Different instances should call function separately
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});
