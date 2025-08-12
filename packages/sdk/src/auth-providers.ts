/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

export interface AuthProvider {
  name: string;
  detect(): boolean;
  getToken(): Promise<string> | string;
}

interface WindowWithAuth extends Window {
  Clerk?: {
    session?: {
      getToken: () => Promise<string>;
    };
  };
}

class ClerkAuthProvider implements AuthProvider {
  name = 'clerk';

  detect(): boolean {
    // Just check if Clerk exists, not if session is ready
    // Session might not be available immediately
    return (
      typeof window !== 'undefined' &&
      (window as WindowWithAuth).Clerk !== undefined
    );
  }

  async getToken(): Promise<string> {
    // Wait for Clerk to be fully initialized
    const maxAttempts = 20; // 2 seconds total
    let attempts = 0;

    while (attempts < maxAttempts) {
      const clerk = (window as WindowWithAuth).Clerk;

      // Check if Clerk and session are available
      if (clerk?.session?.getToken) {
        try {
          const token = await clerk.session.getToken();
          if (token) {
            return token;
          }
        } catch (error) {
          // Session might not be ready yet, continue waiting silently
        }
      }

      // Wait 100ms before next attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    throw new Error('Clerk session not available after 2 seconds');
  }
}

class SupabaseAuthProvider implements AuthProvider {
  name = 'supabase';

  detect(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window as any).supabase?.auth?.getSession !== undefined &&
      typeof (window as any).supabase.auth.getSession === 'function'
    );
  }

  async getToken(): Promise<string> {
    if (!this.detect()) {
      throw new Error('Supabase not ready or auth unavailable');
    }
    const response = (await (window as any).supabase.auth.getSession()) as {
      data?: { session?: { access_token?: string } };
    };
    const token = response?.data?.session?.access_token;
    if (!token) {
      throw new Error('Supabase returned empty token or no active session');
    }
    return token;
  }
}

class Auth0Provider implements AuthProvider {
  name = 'auth0';

  detect(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window as any).auth0?.getAccessTokenSilently !== undefined &&
      typeof (window as any).auth0.getAccessTokenSilently === 'function'
    );
  }

  async getToken(): Promise<string> {
    if (!this.detect()) {
      throw new Error('Auth0 not ready or client unavailable');
    }
    const token = (await (
      window as any
    ).auth0.getAccessTokenSilently()) as string;
    if (!token) {
      throw new Error('Auth0 returned empty token');
    }
    return token;
  }
}

class FirebaseAuthProvider implements AuthProvider {
  name = 'firebase';

  detect(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window as any).firebase?.auth !== undefined &&
      typeof (window as any).firebase.auth === 'function'
    );
  }

  async getToken(): Promise<string> {
    if (!this.detect()) {
      throw new Error('Firebase not ready or auth unavailable');
    }
    const currentUser = (window as any).firebase.auth().currentUser as {
      getIdToken: () => Promise<string>;
    } | null;
    if (!currentUser) {
      throw new Error('Firebase user not authenticated');
    }
    const token = await currentUser.getIdToken();
    if (!token) {
      throw new Error('Firebase returned empty token');
    }
    return token;
  }
}

// Registry pattern for extensibility
const AUTH_PROVIDERS: AuthProvider[] = [
  new ClerkAuthProvider(),
  new SupabaseAuthProvider(),
  new Auth0Provider(),
  new FirebaseAuthProvider(),
];

export function detectAuthProvider(): AuthProvider | null {
  for (const provider of AUTH_PROVIDERS) {
    if (provider.detect()) {
      return provider;
    }
  }
  return null;
}
