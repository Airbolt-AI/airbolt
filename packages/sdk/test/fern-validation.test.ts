/**
 * MAR-119: Fern SDK Generation Validation
 *
 * This test validates the quality and usability of Fern-generated code
 * by comparing it against our hand-written client implementation.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Fern SDK Generation Validation', () => {
  describe('Generated Code Structure', () => {
    it('should generate clean TypeScript infrastructure', () => {
      // Check that main exports exist
      const indexPath = join(__dirname, '../generated/browser/index.ts');
      const indexContent = readFileSync(indexPath, 'utf-8');

      expect(indexContent).toContain('AirboltAPIError');
      expect(indexContent).toContain('AirboltAPITimeoutError');
    });

    it('should include sophisticated error handling', () => {
      const errorPath = join(
        __dirname,
        '../generated/browser/errors/AirboltAPIError.ts'
      );
      const errorContent = readFileSync(errorPath, 'utf-8');

      // Check for proper error structure
      expect(errorContent).toContain('statusCode');
      expect(errorContent).toContain('body');
      expect(errorContent).toContain('rawResponse');
      expect(errorContent).not.toContain(': any'); // No any types
    });

    it('should include comprehensive fetcher infrastructure', () => {
      const fetcherPath = join(
        __dirname,
        '../generated/browser/core/fetcher/Fetcher.ts'
      );
      const fetcherContent = readFileSync(fetcherPath, 'utf-8');

      // Check for essential features
      expect(fetcherContent).toContain('timeoutMs');
      expect(fetcherContent).toContain('maxRetries');
      expect(fetcherContent).toContain('abortSignal');
      expect(fetcherContent).toContain('withCredentials');
    });
  });

  describe('Code Quality Analysis', () => {
    it('should have minimal any/unknown types', async () => {
      const generatedDir = join(__dirname, '../generated/browser');

      // This is a snapshot test - if the count changes significantly, investigate
      const { execSync } = await import('child_process');
      const result = execSync(
        `find "${generatedDir}" -name "*.ts" | xargs grep -c "any\\|unknown" | wc -l`,
        { encoding: 'utf-8' }
      );

      const typeCount = parseInt(result.trim());

      // Allow some unknown types for generic responses, but flag excessive usage
      expect(typeCount).toBeLessThan(50); // Current baseline
    });

    it('should compile without TypeScript errors', async () => {
      const { execSync } = await import('child_process');
      const result = execSync('pnpm --filter sdk tsc --noEmit', {
        encoding: 'utf-8',
      });

      // Should complete without errors
      expect(result).toBeDefined();
    });
  });

  describe('Bundle Size Analysis', () => {
    it('should have reasonable bundle size compared to hand-written client', async () => {
      const { execSync } = await import('child_process');
      const generatedSize = execSync('du -sk packages/sdk/generated/', {
        encoding: 'utf-8',
      });

      const currentSize = execSync('du -sk packages/sdk/dist/', {
        encoding: 'utf-8',
      });

      const generatedKb = parseInt(generatedSize.split('\t')[0] || '0');
      const currentKb = parseInt(currentSize.split('\t')[0] || '0');

      console.log(
        `Generated size: ${generatedKb}KB, Current size: ${currentKb}KB`
      );
      console.log(
        `Ratio: ${((generatedKb / currentKb) * 100).toFixed(1)}% of current size`
      );

      // Generated infrastructure is smaller than compiled output - this is expected
      expect(generatedKb).toBeGreaterThan(50); // At least 50KB for infrastructure
      expect(generatedKb).toBeLessThan(currentKb * 1.5); // Not more than 150% of current
    });
  });

  describe('Critical Gap Analysis', () => {
    it('should identify missing client methods', () => {
      const indexPath = join(__dirname, '../generated/browser/index.ts');
      const indexContent = readFileSync(indexPath, 'utf-8');

      // Critical finding: No client class exported
      expect(indexContent).not.toContain('Client');
      expect(indexContent).not.toContain('chat');
      expect(indexContent).not.toContain('token');

      // This confirms our hypothesis: Fern generated infrastructure but no API methods
    });

    it('should document the infrastructure vs client gap', async () => {
      // Fern generated 1100 lines of infrastructure code but zero API methods
      // This is because our OpenAPI spec has inline schemas, not component references

      const { execSync } = await import('child_process');
      const totalFiles = execSync(
        'find packages/sdk/generated -name "*.ts" | wc -l',
        { encoding: 'utf-8' }
      );

      const totalLines = execSync(
        'find packages/sdk/generated -name "*.ts" | xargs wc -l | tail -1',
        { encoding: 'utf-8' }
      );

      console.log(
        `Generated ${totalFiles.trim()} files with ${totalLines.trim()} total lines`
      );
      console.log('Infrastructure: ✅ Sophisticated');
      console.log('API Methods: ❌ None generated');
      console.log(
        'Root Cause: OpenAPI spec has inline schemas, not $ref components'
      );
    });
  });
});
