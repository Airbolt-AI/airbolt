import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectAuthProvider } from './auth-providers.js';

describe('Auth Provider Detection', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    // Reset window object
    (global as any).window = {};
  });

  afterEach(() => {
    // Restore original window
    (global as any).window = originalWindow;
  });

  describe('Clerk detection', () => {
    it('detects Clerk when available', () => {
      (global as any).window = {
        Clerk: {
          session: {
            getToken: vi.fn().mockResolvedValue('clerk-token'),
          },
        },
      };

      const provider = detectAuthProvider();
      expect(provider).not.toBeNull();
      expect(provider?.name).toBe('clerk');
    });

    it('returns Clerk token', async () => {
      const mockToken = 'clerk-jwt-token';
      (global as any).window = {
        Clerk: {
          session: {
            getToken: vi.fn().mockResolvedValue(mockToken),
          },
        },
      };

      const provider = detectAuthProvider();
      const token = await provider!.getToken();
      expect(token).toBe(mockToken);
      expect((global as any).window.Clerk.session.getToken).toHaveBeenCalled();
    });
  });

  describe('Supabase detection', () => {
    it('detects Supabase when available', () => {
      (global as any).window = {
        supabase: {
          auth: {
            getSession: vi.fn().mockResolvedValue({
              access_token: 'supabase-token',
            }),
          },
        },
      };

      const provider = detectAuthProvider();
      expect(provider).not.toBeNull();
      expect(provider?.name).toBe('supabase');
    });

    it('returns Supabase access token', async () => {
      const mockToken = 'supabase-jwt-token';
      (global as any).window = {
        supabase: {
          auth: {
            getSession: vi.fn().mockResolvedValue({
              data: {
                session: {
                  access_token: mockToken,
                },
              },
            }),
          },
        },
      };

      const provider = detectAuthProvider();
      const token = await provider!.getToken();
      expect(token).toBe(mockToken);
    });

    it('throws error if no session', async () => {
      (global as any).window = {
        supabase: {
          auth: {
            getSession: vi.fn().mockResolvedValue(null),
          },
        },
      };

      const provider = detectAuthProvider();
      await expect(provider!.getToken()).rejects.toThrow(
        'Supabase returned empty token or no active session'
      );
    });
  });

  describe('Auth0 detection', () => {
    it('detects Auth0 when available', () => {
      (global as any).window = {
        auth0: {
          getAccessTokenSilently: vi.fn().mockResolvedValue('auth0-token'),
        },
      };

      const provider = detectAuthProvider();
      expect(provider).not.toBeNull();
      expect(provider?.name).toBe('auth0');
    });

    it('returns Auth0 token', async () => {
      const mockToken = 'auth0-jwt-token';
      (global as any).window = {
        auth0: {
          getAccessTokenSilently: vi.fn().mockResolvedValue(mockToken),
        },
      };

      const provider = detectAuthProvider();
      const token = await provider!.getToken();
      expect(token).toBe(mockToken);
      expect(
        (global as any).window.auth0.getAccessTokenSilently
      ).toHaveBeenCalled();
    });
  });

  describe('Firebase detection', () => {
    it('detects Firebase when available', () => {
      (global as any).window = {
        firebase: {
          auth: vi.fn().mockReturnValue({
            currentUser: {
              getIdToken: vi.fn().mockResolvedValue('firebase-token'),
            },
          }),
        },
      };

      const provider = detectAuthProvider();
      expect(provider).not.toBeNull();
      expect(provider?.name).toBe('firebase');
    });

    it('returns Firebase token', async () => {
      const mockToken = 'firebase-jwt-token';
      const mockGetIdToken = vi.fn().mockResolvedValue(mockToken);
      (global as any).window = {
        firebase: {
          auth: vi.fn().mockReturnValue({
            currentUser: {
              getIdToken: mockGetIdToken,
            },
          }),
        },
      };

      const provider = detectAuthProvider();
      const token = await provider!.getToken();
      expect(token).toBe(mockToken);
      expect(mockGetIdToken).toHaveBeenCalled();
    });

    it('throws error if no current user', async () => {
      (global as any).window = {
        firebase: {
          auth: vi.fn().mockReturnValue({
            currentUser: null,
          }),
        },
      };

      const provider = detectAuthProvider();
      await expect(provider!.getToken()).rejects.toThrow(
        'Firebase user not authenticated'
      );
    });
  });

  describe('Multiple providers', () => {
    it('returns first available provider', () => {
      // Setup multiple providers - Clerk should be detected first
      (global as any).window = {
        Clerk: {
          session: {
            getToken: vi.fn(),
          },
        },
        supabase: {
          auth: {
            getSession: vi.fn(),
          },
        },
        auth0: {
          getAccessTokenSilently: vi.fn(),
        },
      };

      const provider = detectAuthProvider();
      expect(provider?.name).toBe('clerk');
    });
  });

  describe('No providers', () => {
    it('returns null when no providers available', () => {
      (global as any).window = {};
      const provider = detectAuthProvider();
      expect(provider).toBeNull();
    });

    it('returns null in Node.js environment', () => {
      delete (global as any).window;
      const provider = detectAuthProvider();
      expect(provider).toBeNull();
    });
  });
});
