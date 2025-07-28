import { describe, it, expect } from 'vitest';
import { AuthModeDetector } from '../src/utils/auth-mode-detector.js';
import { AuthMode } from '../src/types.js';

describe('AuthModeDetector', () => {
  describe('detect', () => {
    it('should detect CONFIGURED_ISSUER mode when issuer is set', () => {
      const config = {
        EXTERNAL_JWT_ISSUER: 'https://auth.example.com',
      };
      expect(AuthModeDetector.detect(config)).toBe(AuthMode.CONFIGURED_ISSUER);
    });

    it('should detect LEGACY_KEY mode when public key is set', () => {
      const config = {
        EXTERNAL_JWT_PUBLIC_KEY: 'some-public-key',
      };
      expect(AuthModeDetector.detect(config)).toBe(AuthMode.LEGACY_KEY);
    });

    it('should detect LEGACY_KEY mode when secret is set', () => {
      const config = {
        EXTERNAL_JWT_SECRET: 'some-secret',
      };
      expect(AuthModeDetector.detect(config)).toBe(AuthMode.LEGACY_KEY);
    });

    it('should detect AUTO_DISCOVERY mode for development environment', () => {
      const config = {
        NODE_ENV: 'development',
      };
      expect(AuthModeDetector.detect(config)).toBe(AuthMode.AUTO_DISCOVERY);
    });

    it('should detect ANONYMOUS mode for non-development environments', () => {
      const config = {
        NODE_ENV: 'dev',
      };
      expect(AuthModeDetector.detect(config)).toBe(AuthMode.ANONYMOUS);
    });

    it('should detect ANONYMOUS mode for test environment', () => {
      const config = {
        NODE_ENV: 'test',
      };
      expect(AuthModeDetector.detect(config)).toBe(AuthMode.ANONYMOUS);
    });

    it('should detect ANONYMOUS mode for production without config', () => {
      const config = {
        NODE_ENV: 'production',
      };
      expect(AuthModeDetector.detect(config)).toBe(AuthMode.ANONYMOUS);
    });

    it('should detect ANONYMOUS mode when no config provided', () => {
      const config = {};
      expect(AuthModeDetector.detect(config)).toBe(AuthMode.ANONYMOUS);
    });

    it('should prioritize CONFIGURED_ISSUER over other settings', () => {
      const config = {
        EXTERNAL_JWT_ISSUER: 'https://auth.example.com',
        EXTERNAL_JWT_PUBLIC_KEY: 'some-key',
        NODE_ENV: 'development',
      };
      expect(AuthModeDetector.detect(config)).toBe(AuthMode.CONFIGURED_ISSUER);
    });
  });

  describe('getDescription', () => {
    it('should return correct description for each mode', () => {
      expect(AuthModeDetector.getDescription(AuthMode.ANONYMOUS)).toContain(
        'Anonymous mode'
      );
      expect(
        AuthModeDetector.getDescription(AuthMode.CONFIGURED_ISSUER)
      ).toContain('External auth configured');
      expect(AuthModeDetector.getDescription(AuthMode.LEGACY_KEY)).toContain(
        'Legacy external auth'
      );
      expect(
        AuthModeDetector.getDescription(AuthMode.AUTO_DISCOVERY)
      ).toContain('Development mode');
    });
  });
});
