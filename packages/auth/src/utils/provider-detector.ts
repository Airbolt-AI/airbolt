import type { ProviderHints } from '../types.js';
import { AuthError } from '../types.js';

export class ProviderDetector {
  static getProviderHints(issuer: string): ProviderHints {
    if (issuer.includes('.auth0.com')) {
      return {
        setupGuide: 'https://auth0.com/docs/quickstart/spa/react',
        configHelp:
          'Create an API in Auth0 dashboard and set audience parameter',
        audienceRequired: true,
      };
    }

    if (
      issuer.includes('.clerk.dev') ||
      issuer.includes('.clerk.accounts.dev')
    ) {
      return {
        setupGuide: 'https://clerk.com/docs/quickstarts/react',
        configHelp: 'Ensure JWT template includes required claims',
        audienceRequired: false,
      };
    }

    if (issuer.includes('firebase') || issuer.includes('googleapis.com')) {
      return {
        setupGuide: 'https://firebase.google.com/docs/auth/web/start',
        configHelp: 'Configure Firebase Auth with custom claims',
        audienceRequired: false,
      };
    }

    if (issuer.includes('supabase')) {
      return {
        setupGuide: 'https://supabase.com/docs/guides/auth/quickstarts/react',
        configHelp: 'JWT claims are included automatically',
        audienceRequired: false,
      };
    }

    return {
      setupGuide: 'Provider-specific documentation',
      configHelp: 'Ensure JWT includes sub, user_id, or email claims',
      audienceRequired: false,
    };
  }

  static getErrorMessage(originalError: string, issuer: string): string {
    const hints = this.getProviderHints(issuer);

    if (issuer.includes('.auth0.com')) {
      if (originalError.includes('audience')) {
        throw new AuthError(
          'Auth0 token missing audience claim',
          'auth0',
          'Create an API in Auth0 dashboard and configure audience parameter',
          'Visit Auth0 Dashboard → APIs → Create API → Set identifier as audience'
        );
      }

      if (
        originalError.includes('opaque') ||
        originalError.includes('invalid_token')
      ) {
        throw new AuthError(
          'Auth0 returned opaque token instead of JWT',
          'auth0',
          'Configure audience parameter to get JWT tokens',
          'Add audience to Auth0Provider or getAccessTokenSilently() call'
        );
      }
    }

    if (issuer.includes('.clerk.dev')) {
      throw new AuthError(
        `Clerk token validation failed: ${originalError}`,
        'clerk',
        'Ensure JWT template includes required user claims',
        'Check Clerk Dashboard → JWT Templates → Add custom claims if needed'
      );
    }

    // Generic error with provider-specific guidance
    const provider = this.detectProvider(issuer);
    throw new AuthError(
      `Token validation failed: ${originalError}`,
      provider,
      hints.configHelp,
      `Check ${hints.setupGuide} for setup instructions`
    );
  }

  private static detectProvider(issuer: string): string {
    if (issuer.includes('.auth0.com')) return 'auth0';
    if (issuer.includes('.clerk.dev')) return 'clerk';
    if (issuer.includes('firebase') || issuer.includes('googleapis.com'))
      return 'firebase';
    if (issuer.includes('supabase')) return 'supabase';
    return 'unknown';
  }
}
