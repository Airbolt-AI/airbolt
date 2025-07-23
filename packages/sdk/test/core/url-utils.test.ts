import { describe, it, expect } from 'vitest';
import { joinUrl, normalizeUrl } from '../../src/core/url-utils.js';

describe('URL utilities', () => {
  describe('joinUrl', () => {
    describe('basic functionality', () => {
      it('should join simple paths', () => {
        expect(joinUrl('https://api.example.com', 'api', 'tokens')).toBe(
          'https://api.example.com/api/tokens'
        );
      });

      it('should handle single segment', () => {
        expect(joinUrl('https://api.example.com', 'health')).toBe(
          'https://api.example.com/health'
        );
      });

      it('should return base when no segments provided', () => {
        expect(joinUrl('https://api.example.com')).toBe(
          'https://api.example.com'
        );
      });
    });

    describe('trailing slash handling', () => {
      it('should handle single trailing slash on base', () => {
        expect(joinUrl('https://api.example.com/', 'api', 'tokens')).toBe(
          'https://api.example.com/api/tokens'
        );
      });

      it('should handle multiple trailing slashes on base', () => {
        expect(joinUrl('https://api.example.com///', 'api', 'tokens')).toBe(
          'https://api.example.com/api/tokens'
        );
      });

      it('should handle the exact reported issue', () => {
        // This is the exact issue: baseURL with double slash
        expect(joinUrl('https://airbolt.onrender.com//', 'api/tokens')).toBe(
          'https://airbolt.onrender.com/api/tokens'
        );
      });
    });

    describe('segment slash handling', () => {
      it('should handle leading slashes on segments', () => {
        expect(joinUrl('https://api.example.com', '/api', '/tokens')).toBe(
          'https://api.example.com/api/tokens'
        );
      });

      it('should handle trailing slashes on segments', () => {
        expect(joinUrl('https://api.example.com', 'api/', 'tokens/')).toBe(
          'https://api.example.com/api/tokens'
        );
      });

      it('should handle both leading and trailing slashes', () => {
        expect(joinUrl('https://api.example.com/', '/api/', '/tokens/')).toBe(
          'https://api.example.com/api/tokens'
        );
      });

      it('should handle multiple slashes in segments', () => {
        expect(
          joinUrl('https://api.example.com', '//api//', '//tokens//')
        ).toBe('https://api.example.com/api/tokens');
      });
    });

    describe('empty segment handling', () => {
      it('should skip empty string segments', () => {
        expect(
          joinUrl('https://api.example.com', '', 'api', '', 'tokens')
        ).toBe('https://api.example.com/api/tokens');
      });

      it('should skip segments that are only slashes', () => {
        expect(
          joinUrl('https://api.example.com', '/', 'api', '///', 'tokens')
        ).toBe('https://api.example.com/api/tokens');
      });

      it('should handle all empty segments', () => {
        expect(joinUrl('https://api.example.com/', '', '/', '//')).toBe(
          'https://api.example.com'
        );
      });
    });

    describe('complex URLs', () => {
      it('should handle URLs with ports', () => {
        expect(joinUrl('http://localhost:3000', 'api', 'tokens')).toBe(
          'http://localhost:3000/api/tokens'
        );
      });

      it('should handle URLs with existing paths', () => {
        expect(joinUrl('https://api.example.com/v1', 'api', 'tokens')).toBe(
          'https://api.example.com/v1/api/tokens'
        );
      });

      it('should handle URLs with existing paths and trailing slash', () => {
        expect(joinUrl('https://api.example.com/v1/', 'api', 'tokens')).toBe(
          'https://api.example.com/v1/api/tokens'
        );
      });
    });

    describe('error handling', () => {
      it('should throw on empty base URL', () => {
        expect(() => joinUrl('', 'api', 'tokens')).toThrow(
          'Base URL cannot be empty'
        );
      });

      it('should throw on null/undefined base URL', () => {
        expect(() => joinUrl(null as any, 'api', 'tokens')).toThrow();
        expect(() => joinUrl(undefined as any, 'api', 'tokens')).toThrow();
      });
    });

    describe('real-world scenarios', () => {
      it('should handle production Render URL', () => {
        expect(joinUrl('https://airbolt.onrender.com/', 'api/tokens')).toBe(
          'https://airbolt.onrender.com/api/tokens'
        );
      });

      it('should handle localhost development URL', () => {
        expect(joinUrl('http://localhost:3000/', '/api/chat')).toBe(
          'http://localhost:3000/api/chat'
        );
      });

      it('should handle staging URLs with paths', () => {
        expect(
          joinUrl('https://staging.airbolt.com/api/v2/', 'auth/', 'refresh')
        ).toBe('https://staging.airbolt.com/api/v2/auth/refresh');
      });
    });
  });

  describe('normalizeUrl', () => {
    it('should remove single trailing slash', () => {
      expect(normalizeUrl('https://api.example.com/')).toBe(
        'https://api.example.com'
      );
    });

    it('should remove multiple trailing slashes', () => {
      expect(normalizeUrl('https://api.example.com///')).toBe(
        'https://api.example.com'
      );
    });

    it('should not modify URLs without trailing slashes', () => {
      expect(normalizeUrl('https://api.example.com')).toBe(
        'https://api.example.com'
      );
    });

    it('should handle URLs with paths', () => {
      expect(normalizeUrl('https://api.example.com/v1/')).toBe(
        'https://api.example.com/v1'
      );
    });
  });
});
