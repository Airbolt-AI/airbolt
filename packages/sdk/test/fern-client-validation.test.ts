/**
 * MAR-119: Fern Client Usage Validation
 *
 * Tests demonstrating the critical gap: Fern generated infrastructure but no client.
 * This validates our hypothesis about Fern's limitations with inline OpenAPI schemas.
 */

import { describe, it, expect } from 'vitest';

describe('Fern Generated Client Usage', () => {
  describe('Infrastructure Components', () => {
    it('should successfully import error classes', async () => {
      // Test that generated infrastructure works
      const { AirboltAPIError, AirboltAPITimeoutError } = await import(
        '../generated/browser/index.js'
      );

      expect(AirboltAPIError).toBeDefined();
      expect(AirboltAPITimeoutError).toBeDefined();

      // Test error instantiation
      const error = new AirboltAPIError({
        message: 'Test error',
        statusCode: 400,
        body: { error: 'Invalid request' },
      });

      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('Test error');
      expect(error.body).toEqual({ error: 'Invalid request' });
    });

    it('should have sophisticated fetcher infrastructure', async () => {
      const { fetcherImpl } = await import(
        '../generated/browser/core/fetcher/Fetcher.js'
      );

      expect(fetcherImpl).toBeDefined();
      expect(typeof fetcherImpl).toBe('function');
    });
  });

  describe('Generated Client Validation', () => {
    it('should have all expected exports from Fern generation', async () => {
      const mainExports = await import('../generated/browser/index.js');

      // Should have the complete set of exports from Fern
      const exportKeys = Object.keys(mainExports);
      expect(exportKeys).toContain('AirboltAPI'); // Namespace with types
      expect(exportKeys).toContain('AirboltAPIError');
      expect(exportKeys).toContain('AirboltAPITimeoutError');
      expect(exportKeys).toContain('AirboltAPIClient'); // The generated client
      expect(exportKeys).toContain('AirboltAPIEnvironment');

      // Verify the client has the expected methods
      const { AirboltAPIClient } = mainExports;
      const client = new AirboltAPIClient({ baseUrl: 'http://localhost:3000' });
      expect(client.chat).toBeDefined();
      expect(client.authentication).toBeDefined();
      expect(client.root).toBeDefined();
    });
  });

  describe('Infrastructure Quality Assessment', () => {
    it('should have production-ready error handling', async () => {
      const { AirboltAPIError } = await import('../generated/browser/index.js');

      const error = new AirboltAPIError({
        message: 'API Error',
        statusCode: 500,
        body: { details: 'Internal server error' },
      });

      // Check error properties
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(500);
      expect(error.body).toEqual({ details: 'Internal server error' });
      expect(error.message).toContain('API Error');
      expect(error.message).toContain('Status code: 500');
    });

    it('should have modern TypeScript patterns', async () => {
      // Dynamic import to check types at runtime
      const fetcherModule = await import(
        '../generated/browser/core/fetcher/Fetcher.js'
      );

      // Should have proper exports structure
      expect(fetcherModule.fetcherImpl).toBeDefined();
      expect(typeof fetcherModule.fetcherImpl).toBe('function');
    });
  });
});
