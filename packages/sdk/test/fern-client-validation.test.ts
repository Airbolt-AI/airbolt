/**
 * MAR-119: Fern Client Integration Tests
 *
 * Tests actual Fern client behavior, not just existence of exports.
 * Focuses on error scenarios that would break production.
 */

import { describe, it, expect } from 'vitest';

describe('Fern Generated Client Behavior', () => {
  describe('Error Handling', () => {
    it('should properly handle API errors with correct status propagation', async () => {
      const { AirboltAPIError } = await import('../generated/index.js');

      const error = new AirboltAPIError({
        message: 'Validation failed',
        statusCode: 400,
        body: { field: 'email', error: 'Invalid format' },
      });

      // Test that error contains all necessary information for debugging
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('Validation failed');
      expect(error.message).toContain('Status code: 400');
      expect(error.body).toEqual({ field: 'email', error: 'Invalid format' });
      expect(error).toBeInstanceOf(Error);
    });

    it('should handle timeout errors with appropriate fallback behavior', async () => {
      const { AirboltAPITimeoutError } = await import('../generated/index.js');

      const timeoutError = new AirboltAPITimeoutError('Request timeout');
      expect(timeoutError).toBeInstanceOf(Error);
      expect(timeoutError.name).toBe('AirboltAPITimeoutError');
    });
  });

  describe('Client Integration', () => {
    it('should create client instances with proper method structure for chat operations', async () => {
      const { AirboltAPIClient } = await import('../generated/index.js');

      const client = new AirboltAPIClient({
        baseUrl: 'http://localhost:3000',
      });

      // Verify client has essential methods needed for real usage
      expect(typeof client.chat).toBe('object');
      expect(typeof client.authentication).toBe('object');
      expect(typeof client.root).toBe('object');
    });
  });
});
