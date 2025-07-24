/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

export interface AuthProvider {
  name: string;
  detect(): boolean;
  getToken(): Promise<string> | string;
}

class ClerkAuthProvider implements AuthProvider {
  name = 'clerk';

  detect(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window as any).Clerk?.session?.getToken !== undefined
    );
  }

  async getToken(): Promise<string> {
    return (window as any).Clerk.session.getToken() as Promise<string>;
  }
}

class SupabaseAuthProvider implements AuthProvider {
  name = 'supabase';

  detect(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window as any).supabase?.auth?.getSession !== undefined
    );
  }

  async getToken(): Promise<string> {
    const session = (await (window as any).supabase.auth.getSession()) as {
      access_token?: string;
    };
    return session?.access_token || '';
  }
}

class Auth0Provider implements AuthProvider {
  name = 'auth0';

  detect(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window as any).auth0?.getAccessTokenSilently !== undefined
    );
  }

  getToken(): Promise<string> {
    return (window as any).auth0.getAccessTokenSilently() as Promise<string>;
  }
}

class FirebaseAuthProvider implements AuthProvider {
  name = 'firebase';

  detect(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window as any).firebase?.auth !== undefined
    );
  }

  getToken(): Promise<string> {
    const currentUser = (window as any).firebase.auth().currentUser as {
      getIdToken: () => Promise<string>;
    } | null;
    if (!currentUser) {
      return Promise.resolve('');
    }
    return currentUser.getIdToken();
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
