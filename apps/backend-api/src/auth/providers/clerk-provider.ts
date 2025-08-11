import type { AuthProvider, VerifyContext } from '../types/provider.js';
import type { JWTClaims } from '../../types/auth.js';
import { ProviderPriority } from '../types/provider.js';
import { AuditEventType } from '../audit-logger.js';
import {
  verifyClerkToken,
  type ClerkJWTClaims,
  type ClerkVerificationOptions,
} from '../clerk-verifier.js';
import { detectIssuerType, IssuerType } from '../issuer-validator.js';
import {
  validateTokenFormat,
  extractIssuer,
  extractIssuerSafely,
  handleVerificationError,
  logSecurityEvent,
  createHashKey,
  sanitizeUserId,
  sanitizeSessionId,
} from '../utils/auth-utils.js';

/**
 * Clerk authentication provider - simple object implementation
 */
type ClerkProviderConfig = {
  provider: 'clerk';
  issuer?: string;
  authorizedParties?: string[];
  publishableKey?: string;
  secretKey?: string;
};

function validateClerkConfig(config: ClerkProviderConfig): void {
  if (!config.provider || config.provider !== 'clerk') {
    throw new Error(
      'Clerk provider configuration must have provider set to "clerk"'
    );
  }

  // Validate authorized parties format if provided
  if (config.authorizedParties) {
    if (!Array.isArray(config.authorizedParties)) {
      throw new Error('Clerk authorizedParties must be an array of URLs');
    }

    for (const party of config.authorizedParties) {
      if (!party || typeof party !== 'string') {
        throw new Error('Each authorized party must be a non-empty string');
      }

      try {
        new URL(party);
      } catch {
        throw new Error(`Invalid authorized party URL: ${party}`);
      }
    }
  }

  // Validate issuer if explicitly provided (usually auto-detected)
  if (config.issuer) {
    try {
      new URL(config.issuer);
    } catch {
      throw new Error('Clerk issuer must be a valid URL');
    }

    const issuerType = detectIssuerType(config.issuer);
    if (issuerType !== IssuerType.CLERK) {
      throw new Error(
        `Clerk issuer must match Clerk domain pattern: ${config.issuer}`
      );
    }
  }

  // Validate keys format if provided
  if (config.publishableKey && !config.publishableKey.startsWith('pk_')) {
    throw new Error('Clerk publishable key must start with "pk_"');
  }

  if (config.secretKey && !config.secretKey.startsWith('sk_')) {
    throw new Error('Clerk secret key must start with "sk_"');
  }
}

export const clerkProvider: AuthProvider = {
  name: 'clerk',
  priority: ProviderPriority.CLERK,

  canHandle(issuer: string): boolean {
    if (!issuer || typeof issuer !== 'string') {
      return false;
    }

    // Use the existing issuer detection logic
    const issuerType = detectIssuerType(issuer);
    return issuerType === IssuerType.CLERK;
  },

  async verify(token: string, context: VerifyContext): Promise<JWTClaims> {
    try {
      // Validate token format first
      validateTokenFormat(token);

      // Extract and validate issuer
      const issuer = extractIssuer(token);

      if (!this.canHandle(issuer)) {
        throw handleVerificationError(
          new Error(`Token issuer ${issuer} is not a Clerk issuer`),
          this.name,
          { issuer, tokenHash: createHashKey(token, 'verification') }
        );
      }

      // Get Clerk config from auth config
      const clerkConfig = context.config.providers.find(
        (p): p is ClerkProviderConfig => p.provider === 'clerk'
      );

      if (!clerkConfig) {
        throw new Error('Clerk provider configuration not found');
      }

      // Build Clerk verification options
      const verificationOptions: ClerkVerificationOptions = {};

      // Add authorized parties if configured
      if (
        clerkConfig.authorizedParties &&
        clerkConfig.authorizedParties.length > 0
      ) {
        verificationOptions.authorizedParties = clerkConfig.authorizedParties;
      }

      // Use existing Clerk verifier for the heavy lifting
      const clerkClaims = await verifyClerkToken(token, verificationOptions);

      // Log successful verification
      logSecurityEvent(
        AuditEventType.AUTH_TOKEN_EXCHANGE_SUCCESS,
        {
          issuer,
          userId: sanitizeUserId(clerkClaims.sub),
          sessionId: clerkClaims.session_id
            ? sanitizeSessionId(clerkClaims.session_id)
            : undefined,
          orgId: clerkClaims.org_id
            ? sanitizeUserId(clerkClaims.org_id)
            : undefined,
          hasAuthorizedParty: Boolean(clerkClaims.azp),
        },
        context.logger,
        this.name
      );

      // Return claims (ClerkJWTClaims extends JWTClaims)
      return clerkClaims;
    } catch (error) {
      // Enhanced error handling with Clerk-specific context
      const providerError = handleVerificationError(error, this.name, {
        issuer: extractIssuerSafely(token),
        tokenHash: createHashKey(token, 'verification'),
      });

      // Log security event for failed verification
      logSecurityEvent(
        AuditEventType.AUTH_JWT_VERIFICATION_FAILURE,
        {
          errorType: providerError.code,
          errorMessage: providerError.message,
          issuer: extractIssuerSafely(token),
        },
        context.logger,
        this.name
      );

      throw providerError;
    }
  },
};

/**
 * Factory function to create a Clerk provider instance
 * Validates config and returns the provider object
 *
 * @param config - Clerk provider configuration
 * @returns Configured Clerk provider instance
 */
export function createClerkProvider(config: ClerkProviderConfig): AuthProvider {
  validateClerkConfig(config);
  return clerkProvider;
}

/**
 * Type guard to check if claims are Clerk-specific claims
 * Useful for type narrowing in application code
 *
 * @param claims - JWT claims to check
 * @returns true if claims have Clerk-specific fields
 */
export function isClerkClaims(claims: JWTClaims): claims is ClerkJWTClaims {
  return (
    'session_id' in claims ||
    'org_id' in claims ||
    'org_slug' in claims ||
    'azp' in claims
  );
}

/**
 * Helper to determine if a Clerk token represents an active user session
 * Clerk session tokens have specific characteristics that distinguish them
 * from other Clerk token types (like organization tokens or API tokens)
 *
 * @param claims - Clerk JWT claims
 * @returns true if token represents an active user session
 */
export function isClerkUserSession(claims: ClerkJWTClaims): boolean {
  // Active user sessions have both session_id and sub (user ID)
  return Boolean(claims.session_id && claims.sub);
}

/**
 * Helper to check if a Clerk token has organization context
 * Useful for multi-tenant applications
 *
 * @param claims - Clerk JWT claims
 * @returns true if token includes organization information
 */
export function hasClerkOrganizationContext(claims: ClerkJWTClaims): boolean {
  return Boolean(claims.org_id || claims.org_slug);
}
