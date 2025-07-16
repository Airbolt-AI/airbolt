import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTimeoutSignal,
  isTimeoutError,
} from '../../src/core/timeout-utils';

describe('timeout-utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('createTimeoutSignal', () => {
    it('should use native AbortSignal.timeout when available', () => {
      // Mock native implementation
      const mockSignal = { aborted: false } as AbortSignal;
      const originalTimeout = AbortSignal.timeout;
      (AbortSignal as any).timeout = vi.fn(() => mockSignal);

      const signal = createTimeoutSignal(5000);

      expect(signal).toBe(mockSignal);
      expect(AbortSignal.timeout).toHaveBeenCalledWith(5000);

      // Restore
      if (originalTimeout) {
        AbortSignal.timeout = originalTimeout;
      } else {
        delete (AbortSignal as any).timeout;
      }
    });

    it('should create polyfilled signal when native is not available', () => {
      // Remove native implementation
      const originalTimeout = AbortSignal.timeout;
      delete (AbortSignal as any).timeout;

      const signal = createTimeoutSignal(1000);

      expect(signal).toBeDefined();
      expect(signal.aborted).toBe(false);

      // Advance timer
      vi.advanceTimersByTime(1000);

      expect(signal.aborted).toBe(true);

      // Restore
      if (originalTimeout) {
        AbortSignal.timeout = originalTimeout;
      }
    });

    it('should clean up timeout when signal is aborted early', () => {
      // Remove native implementation
      const originalTimeout = AbortSignal.timeout;
      delete (AbortSignal as any).timeout;

      const controller = new AbortController();
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      // Override AbortController to return our controller
      const OriginalAbortController = global.AbortController;
      global.AbortController = vi.fn(() => controller) as any;

      createTimeoutSignal(5000);

      // Manually abort
      controller.abort();

      // Cleanup should have been called
      expect(clearTimeoutSpy).toHaveBeenCalled();

      // Restore
      global.AbortController = OriginalAbortController;
      if (originalTimeout) {
        AbortSignal.timeout = originalTimeout;
      }
    });
  });

  describe('isTimeoutError', () => {
    it('should detect AbortError by name', () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';

      expect(isTimeoutError(error)).toBe(true);
    });

    it('should detect DOMException AbortError', () => {
      const error = new Error('The signal is aborted due to timeout');
      error.name = 'AbortError';

      expect(isTimeoutError(error)).toBe(true);
    });

    it('should detect timeout in error message', () => {
      const error = new Error('Request timeout exceeded');

      expect(isTimeoutError(error)).toBe(true);
    });

    it('should return false for non-timeout errors', () => {
      expect(isTimeoutError(new Error('Network error'))).toBe(false);
      expect(isTimeoutError(null)).toBe(false);
      expect(isTimeoutError(undefined)).toBe(false);
      expect(isTimeoutError('string error')).toBe(false);
      expect(isTimeoutError({})).toBe(false);
    });

    it('should handle errors without name property', () => {
      const error = { message: 'Some error' };
      expect(isTimeoutError(error)).toBe(false);
    });
  });
});
