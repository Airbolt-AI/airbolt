export interface ProviderHints {
  name: string;
  audienceHint?: string;
  docLink: string;
  isOpaque?: boolean;
}

export class ProviderDetector {
  private static readonly PROVIDER_PATTERNS: Array<{
    pattern: RegExp | ((issuer: string) => boolean);
    hints: ProviderHints;
  }> = [
    {
      pattern: /auth0\.com/,
      hints: {
        name: 'Auth0',
        audienceHint: 'Create an API in Auth0 Dashboard → APIs → Create API',
        docLink: 'https://docs.airbolt.io/auth0',
      },
    },
    {
      pattern: /clerk\.(dev|com)/,
      hints: {
        name: 'Clerk',
        audienceHint: 'Clerk tokens include audience by default',
        docLink: 'https://docs.airbolt.io/clerk',
      },
    },
    {
      pattern: /securetoken\.google\.com/,
      hints: {
        name: 'Firebase',
        audienceHint: 'Firebase tokens include audience by default',
        docLink: 'https://docs.airbolt.io/firebase',
      },
    },
    {
      pattern: /supabase\.(co|io)/,
      hints: {
        name: 'Supabase',
        audienceHint:
          'Configure JWT audience in Supabase Dashboard → Auth → Settings',
        docLink: 'https://docs.airbolt.io/supabase',
      },
    },
  ];

  static getProviderHints(issuer: string): ProviderHints | null {
    for (const provider of this.PROVIDER_PATTERNS) {
      const matches =
        typeof provider.pattern === 'function'
          ? provider.pattern(issuer)
          : provider.pattern.test(issuer);

      if (matches) {
        return provider.hints;
      }
    }

    return null;
  }

  static detectOpaqueToken(token: string): boolean {
    // Auth0 opaque tokens are typically shorter and don't have 3 parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      return true;
    }

    // Try to decode the header to check if it's a JWE (encrypted)
    try {
      const headerPart = parts[0];
      if (!headerPart) {
        return true;
      }
      const header = JSON.parse(
        Buffer.from(headerPart, 'base64url').toString()
      ) as Record<string, unknown>;
      // JWE tokens have 'enc' field
      if ('enc' in header && header['enc']) {
        return true;
      }
    } catch {
      // If we can't decode, it might be opaque
      return true;
    }

    return false;
  }

  static getTrustedProviders(): string[] {
    return [
      'auth0.com',
      'clerk.dev',
      'clerk.com',
      'firebase.google.com',
      'securetoken.google.com',
      'supabase.co',
      'supabase.io',
    ];
  }

  static isTrustedProvider(issuer: string): boolean {
    return this.getTrustedProviders().some(provider =>
      issuer.includes(provider)
    );
  }

  static getErrorMessage(
    error: string,
    issuer?: string,
    token?: string
  ): string {
    // Check for opaque token
    if (token && this.detectOpaqueToken(token)) {
      const hints = issuer ? this.getProviderHints(issuer) : null;
      if (hints?.name === 'Auth0') {
        return `Auth0 token is opaque (no audience). ${hints.audienceHint}\n\nFix: ${hints.docLink}`;
      }
      return 'Token appears to be opaque or encrypted. JWT validation requires signed tokens (JWS), not encrypted tokens (JWE).';
    }

    // Check for missing audience
    if (error.includes('aud') || error.includes('audience')) {
      const hints = issuer ? this.getProviderHints(issuer) : null;
      if (hints) {
        return `Token missing audience claim.\n${hints.audienceHint}\n\nFix: ${hints.docLink}`;
      }
      return 'Token missing audience claim. Configure your auth provider to include an audience.';
    }

    // Check for issuer mismatch
    if (error.includes('iss') || error.includes('issuer')) {
      return `Token issuer mismatch. Check that EXTERNAL_JWT_ISSUER matches your auth provider's issuer.`;
    }

    // Check for expired token
    if (error.includes('exp') || error.includes('expired')) {
      return 'Token has expired. Please obtain a fresh token.';
    }

    return error;
  }
}
