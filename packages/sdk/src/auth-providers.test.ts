import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { test, fc } from '@fast-check/vitest';
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
          loaded: true,
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
          loaded: true,
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
          loaded: true,
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

  describe('Property tests - Edge cases', () => {
    test.prop([
      fc.record({
        hasClerk: fc.boolean(),
        clerkLoaded: fc.boolean(),
        clerkSession: fc.option(fc.constant({ getToken: vi.fn() })),
        hasSupabase: fc.boolean(),
        supabaseAuth: fc.option(
          fc.constant({
            getSession: vi.fn().mockResolvedValue({
              data: { session: { access_token: 'supabase-token' } },
            }),
          })
        ),
        hasAuth0: fc.boolean(),
        auth0Method: fc.option(
          fc.constant(vi.fn().mockResolvedValue('auth0-token'))
        ),
        hasFirebase: fc.boolean(),
        firebaseAuth: fc.option(
          fc.constant(() => ({
            currentUser: {
              getIdToken: vi.fn().mockResolvedValue('firebase-token'),
            },
          }))
        ),
      }),
    ])(
      'correctly prioritizes providers in all combinations',
      ({
        hasClerk,
        clerkLoaded,
        clerkSession,
        hasSupabase,
        supabaseAuth,
        hasAuth0,
        auth0Method,
        hasFirebase,
        firebaseAuth,
      }) => {
        // Setup window based on scenario
        const windowObj: any = {};

        if (hasClerk) {
          windowObj.Clerk = {
            loaded: clerkLoaded,
            session: clerkSession === null ? undefined : clerkSession,
          };
        }

        if (hasSupabase) {
          windowObj.supabase = supabaseAuth ? { auth: supabaseAuth } : {};
        }

        if (hasAuth0) {
          windowObj.auth0 = auth0Method
            ? { getAccessTokenSilently: auth0Method }
            : {};
        }

        if (hasFirebase) {
          windowObj.firebase = firebaseAuth ? { auth: firebaseAuth } : {};
        }

        (global as any).window = windowObj;

        const provider = detectAuthProvider();

        // Verify detection logic follows priority order
        // Clerk requires loaded === true and session !== undefined (not null)
        const shouldDetectClerk =
          hasClerk && clerkLoaded && clerkSession !== null;
        const shouldDetectSupabase =
          !shouldDetectClerk && hasSupabase && supabaseAuth !== null;
        const shouldDetectAuth0 =
          !shouldDetectClerk &&
          !shouldDetectSupabase &&
          hasAuth0 &&
          auth0Method !== null;
        const shouldDetectFirebase =
          !shouldDetectClerk &&
          !shouldDetectSupabase &&
          !shouldDetectAuth0 &&
          hasFirebase &&
          firebaseAuth !== null;

        if (shouldDetectClerk) {
          expect(provider?.name).toBe('clerk');
        } else if (shouldDetectSupabase) {
          expect(provider?.name).toBe('supabase');
        } else if (shouldDetectAuth0) {
          expect(provider?.name).toBe('auth0');
        } else if (shouldDetectFirebase) {
          expect(provider?.name).toBe('firebase');
        } else {
          expect(provider).toBeNull();
        }
      }
    );

    test.prop([
      fc.record({
        throwOnClerk: fc.boolean(),
        throwOnSupabase: fc.boolean(),
        errorMessage: fc.string({ minLength: 1, maxLength: 50 }),
      }),
    ])(
      'handles provider errors gracefully',
      async ({ throwOnClerk, throwOnSupabase, errorMessage }) => {
        // Setup providers with potential errors
        (global as any).window = {
          Clerk: throwOnClerk
            ? undefined
            : {
                loaded: true,
                session: {
                  getToken: vi.fn().mockRejectedValue(new Error(errorMessage)),
                },
              },
          supabase: throwOnSupabase
            ? undefined
            : {
                auth: {
                  getSession: vi
                    .fn()
                    .mockRejectedValue(new Error(errorMessage)),
                },
              },
        };

        const provider = detectAuthProvider();

        if (!throwOnClerk) {
          expect(provider?.name).toBe('clerk');
          await expect(provider!.getToken()).rejects.toThrow(errorMessage);
        } else if (!throwOnSupabase) {
          expect(provider?.name).toBe('supabase');
          await expect(provider!.getToken()).rejects.toThrow();
        } else {
          expect(provider).toBeNull();
        }
      }
    );

    it('handles missing tokens gracefully', async () => {
      // Test that provider fails when no valid token is available
      // This tests BEHAVIOR not implementation: "no token = auth fails"

      (global as any).window = {
        Clerk: {
          loaded: true,
          session: {
            // Simulate Clerk returning no token (common in signed-out state)
            getToken: vi.fn().mockResolvedValue(null),
          },
        },
      };

      const provider = detectAuthProvider();
      expect(provider?.name).toBe('clerk');

      // Should fail when no token is available
      // We don't care HOW it fails (retries, timing, etc)
      // We only care THAT it fails appropriately
      await expect(provider!.getToken()).rejects.toThrow();
    });
  });
});
