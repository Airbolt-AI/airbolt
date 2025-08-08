// Type definitions for external auth providers
interface ClerkGlobal {
  loaded?: boolean;
  session?: {
    getToken?: () => Promise<string>;
  };
}

interface SupabaseGlobal {
  auth?: {
    getSession?: () => Promise<{
      data?: { session?: { access_token?: string } };
    }>;
  };
}

interface Auth0Global {
  getAccessTokenSilently?: () => Promise<string>;
}

interface FirebaseGlobal {
  auth?: () => {
    currentUser?: {
      getIdToken: () => Promise<string>;
    } | null;
  };
}

// Extend Window interface with auth provider types
declare global {
  interface Window {
    Clerk?: ClerkGlobal;
    supabase?: SupabaseGlobal;
    auth0?: Auth0Global;
    firebase?: FirebaseGlobal;
  }
}

export interface AuthProvider {
  name: string;
  detect(): boolean;
  getToken(): Promise<string> | string;
}

class ClerkAuthProvider implements AuthProvider {
  name = 'clerk';

  detect(): boolean {
    // Check if Clerk is fully loaded (not just present)
    return (
      typeof window !== 'undefined' &&
      window.Clerk?.loaded === true &&
      window.Clerk?.session !== undefined &&
      window.Clerk?.session !== null
    );
  }

  async getToken(): Promise<string> {
    // Handle async Clerk initialization
    const maxAttempts = 20; // 2 seconds
    let attempts = 0;

    while (attempts++ < maxAttempts) {
      const getTokenFn = window.Clerk?.session?.getToken;
      if (getTokenFn) {
        const token = await getTokenFn();
        if (token) return token;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Clerk session not available');
  }
}

class SupabaseAuthProvider implements AuthProvider {
  name = 'supabase';

  detect(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.supabase?.auth?.getSession !== undefined &&
      typeof window.supabase.auth.getSession === 'function'
    );
  }

  async getToken(): Promise<string> {
    if (!this.detect()) {
      throw new Error('Supabase not ready or auth unavailable');
    }

    const getSession = window.supabase?.auth?.getSession;
    if (!getSession) {
      throw new Error('Supabase getSession not available');
    }

    const response = await getSession();
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
      window.auth0?.getAccessTokenSilently !== undefined &&
      typeof window.auth0.getAccessTokenSilently === 'function'
    );
  }

  async getToken(): Promise<string> {
    if (!this.detect()) {
      throw new Error('Auth0 not ready or client unavailable');
    }

    const getAccessTokenSilently = window.auth0?.getAccessTokenSilently;
    if (!getAccessTokenSilently) {
      throw new Error('Auth0 getAccessTokenSilently not available');
    }

    const token = await getAccessTokenSilently();
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
      window.firebase?.auth !== undefined &&
      typeof window.firebase.auth === 'function'
    );
  }

  async getToken(): Promise<string> {
    if (!this.detect()) {
      throw new Error('Firebase not ready or auth unavailable');
    }

    const auth = window.firebase?.auth;
    if (!auth) {
      throw new Error('Firebase auth not available');
    }

    const currentUser = auth().currentUser;
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
