import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectAuthProvider } from '../src/auth-providers.js';

describe('Auth Detection Integration', () => {
  beforeEach(() => {
    // Reset window
    (global as any).window = {};
  });

  describe('Real-world Clerk scenarios', () => {
    it('detects Clerk when inside ClerkProvider context', () => {
      // Simulate what ClerkProvider actually sets on window
      (global as any).window = {
        Clerk: {
          loaded: true,
          session: {
            id: 'sess_123',
            getToken: vi.fn().mockResolvedValue('test-jwt-token'),
          },
        },
      };

      const provider = detectAuthProvider();

      expect(provider).not.toBeNull();
      expect(provider?.name).toBe('clerk');
    });

    it('does NOT detect Clerk when outside ClerkProvider context', () => {
      // Clerk script loaded but not initialized (outside provider)
      (global as any).window = {
        Clerk: {
          loaded: false, // Not yet loaded
          session: undefined,
        },
      };

      const provider = detectAuthProvider();

      expect(provider).toBeNull();
    });

    it('does NOT detect Clerk before ClerkProvider initializes', () => {
      // Clerk object exists but not ready
      (global as any).window = {
        Clerk: {
          // No loaded property yet
          session: undefined,
        },
      };

      const provider = detectAuthProvider();

      expect(provider).toBeNull();
    });

    it('correctly detects Clerk after async load completes', () => {
      // First: Clerk loading
      (global as any).window = {
        Clerk: {
          loaded: false,
        },
      };

      let provider = detectAuthProvider();
      expect(provider).toBeNull();

      // Then: Clerk finishes loading
      (global as any).window.Clerk = {
        loaded: true,
        session: {
          getToken: vi.fn().mockResolvedValue('test-jwt'),
        },
      };

      provider = detectAuthProvider();
      expect(provider).not.toBeNull();
      expect(provider?.name).toBe('clerk');
    });
  });

  describe('Documentation accuracy', () => {
    it('confirms ChatWidget inside SignedIn would work', () => {
      // SignedIn component only renders children when Clerk.session exists
      // So if ChatWidget is inside SignedIn, this is what it would see:
      (global as any).window = {
        Clerk: {
          loaded: true,
          session: {
            id: 'sess_abc',
            getToken: vi.fn().mockResolvedValue('jwt-token'),
          },
        },
      };

      const provider = detectAuthProvider();

      expect(provider).not.toBeNull();
      expect(provider?.name).toBe('clerk');

      // This confirms our docs are correct:
      // <SignedIn><ChatWidget /></SignedIn> would auto-detect auth
    });

    it('confirms ChatWidget outside SignedIn would NOT work', () => {
      // User signed out - SignedIn wouldn't render ChatWidget
      // But if ChatWidget was outside SignedIn, it would see:
      (global as any).window = {
        Clerk: {
          loaded: true,
          session: null, // No session when signed out
        },
      };

      const provider = detectAuthProvider();

      // Would not detect because session is null
      expect(provider).toBeNull();

      // This confirms why ChatWidget needs to be inside SignedIn
    });
  });
});
