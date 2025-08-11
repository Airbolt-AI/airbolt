import type { AuthProvider, VerifyContext } from '../types/provider.js';
import type { JWTClaims } from '../../types/auth.js';
import { ProviderPriority } from '../types/provider.js';
import { AuditEventType } from '../audit-logger.js';
import {
  validateTokenFormat,
  extractIssuer,
  extractIssuerSafely,
  handleVerificationError,
  logSecurityEvent,
  createHashKey,
  sanitizeUserId,
  getJWKS,
  performJWTVerification,
  convertToJWTClaims,
} from '../utils/auth-utils.js';

/**
 * Auth0-specific types
 */
type Auth0ProviderConfig = {
  provider: 'auth0';
  domain: string;
  audience?: string;
  issuer?: string;
};

interface Auth0JWTClaims extends JWTClaims {
  /** Authorized party */
  azp?: string;
  /** Scope permissions */
  scope?: string;
  /** Permissions array */
  permissions?: string[];
  /** Custom namespace claims */
  [namespace: string]: unknown;
}

/**
 * Auth0 authentication provider - simple object implementation
 */

function validateAuth0Config(config: Auth0ProviderConfig): void {
  if (!config.provider || config.provider !== 'auth0') {
    throw new Error(
      'Auth0 provider configuration must have provider set to "auth0"'
    );
  }

  if (!config.domain || typeof config.domain !== 'string') {
    throw new Error('Auth0 provider requires a valid domain');
  }

  // Validate domain format
  if (config.domain.includes('://') || config.domain.endsWith('/')) {
    throw new Error(
      'Auth0 domain should not include protocol or trailing slash'
    );
  }

  // Validate issuer format if provided
  if (config.issuer) {
    try {
      const url = new URL(config.issuer);
      if (!url.pathname.endsWith('/')) {
        throw new Error('Auth0 issuer must end with a trailing slash');
      }
    } catch {
      throw new Error('Auth0 issuer must be a valid URL');
    }
  }

  // Validate audience format if provided
  if (config.audience) {
    if (typeof config.audience !== 'string' || config.audience.trim() === '') {
      throw new Error('Auth0 audience must be a non-empty string');
    }

    // Audience is typically a URI identifier for the API
    try {
      new URL(config.audience);
    } catch {
      // Audience doesn't have to be a valid URL, but if it looks like one, validate it
      if (config.audience.startsWith('http')) {
        throw new Error('Auth0 audience appears to be a URL but is not valid');
      }
    }
  }
}

function canHandleAuth0Issuer(
  issuer: string,
  config: Auth0ProviderConfig
): boolean {
  if (!issuer || typeof issuer !== 'string') {
    return false;
  }

  // Auth0 issuer pattern: https://{tenant}.{region}.auth0.com/
  const auth0Pattern = /^https:\/\/.*\.auth0\.com\/$/;

  // Check direct pattern match
  if (auth0Pattern.test(issuer)) {
    return true;
  }

  // If config has explicit issuer, check for exact match
  if (config.issuer && issuer === config.issuer) {
    return true;
  }

  // Check if issuer matches the configured domain
  if (config.domain) {
    const domainIssuer = `https://${config.domain}/`;
    return issuer === domainIssuer;
  }

  return false;
}

/**
 * Extracts permissions from Auth0 JWT payload
 */
function extractPermissions(
  payload: Record<string, unknown>
): string[] | undefined {
  // Check standard locations for permissions
  if (Array.isArray(payload['permissions'])) {
    return payload['permissions'].filter(
      (p): p is string => typeof p === 'string'
    );
  }

  // Check common custom namespace patterns
  const namespacePatterns = [
    'https://your-app.com/permissions',
    'https://api.your-app.com/permissions',
    'permissions',
    'scopes',
  ];

  for (const pattern of namespacePatterns) {
    // eslint-disable-next-line security/detect-object-injection -- Safe: pattern is from controlled array of known permission field names
    const permissions = payload[pattern];
    if (Array.isArray(permissions)) {
      return permissions.filter((p): p is string => typeof p === 'string');
    }
  }

  // If scope exists, split it into permissions array
  if (typeof payload['scope'] === 'string' && payload['scope'].trim()) {
    return payload['scope'].split(' ').filter(scope => scope.trim() !== '');
  }

  return undefined;
}

/**
 * Extracts custom namespace claims from Auth0 JWT payload
 */
function extractNamespaceClaims(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const namespaceClaims: Record<string, unknown> = {};

  // Extract claims with common namespace patterns
  const namespacePatterns = [
    /^https?:\/\/[^/]+\//, // URL-based namespaces
    /^[^:]+:/, // Simple prefix namespaces
  ];

  for (const [key, value] of Object.entries(payload)) {
    // Skip standard JWT claims
    if (
      [
        'iss',
        'sub',
        'aud',
        'exp',
        'iat',
        'nbf',
        'jti',
        'azp',
        'scope',
        'permissions',
      ].includes(key)
    ) {
      continue;
    }

    // Check if key matches any namespace pattern
    const isNamespaced = namespacePatterns.some(pattern => pattern.test(key));
    if (isNamespaced) {
      // eslint-disable-next-line security/detect-object-injection -- Safe: key is from Object.entries() iteration of JWT payload
      namespaceClaims[key] = value;
    }
  }

  return namespaceClaims;
}

/**
 * Sanitizes scope for logging
 */
function sanitizeScope(scope: string): string {
  const scopes = scope.split(' ');
  if (scopes.length <= 5) return scope;
  return scopes.slice(0, 5).join(' ') + ` ... (+${scopes.length - 5} more)`;
}

export const auth0Provider: AuthProvider = {
  name: 'auth0',
  priority: ProviderPriority.AUTH0,

  canHandle(issuer: string): boolean {
    // We need config to determine canHandle, so we'll do a simple pattern check here
    // and validate properly in verify()
    if (!issuer || typeof issuer !== 'string') {
      return false;
    }

    // Auth0 issuer pattern: https://{tenant}.{region}.auth0.com/
    const auth0Pattern = /^https:\/\/.*\.auth0\.com\/$/;
    return auth0Pattern.test(issuer);
  },

  async verify(token: string, context: VerifyContext): Promise<JWTClaims> {
    try {
      // Validate token format first
      validateTokenFormat(token);

      // Extract and validate issuer
      const issuer = extractIssuer(token);

      // Get Auth0 config from auth config
      const auth0Config = context.config.providers.find(
        (p): p is Auth0ProviderConfig => p.provider === 'auth0'
      );

      if (!auth0Config) {
        throw new Error('Auth0 provider configuration not found');
      }

      if (!canHandleAuth0Issuer(issuer, auth0Config)) {
        throw handleVerificationError(
          new Error(`Token issuer ${issuer} is not an Auth0 issuer`),
          this.name,
          { issuer, tokenHash: createHashKey(token, 'verification') }
        );
      }

      // Get JWKS key retrieval function
      const getKey = getJWKS(issuer, context, this.name);

      // Build verification options
      const verificationOptions = {
        issuer, // Validate issuer
        clockTolerance: 5, // 5 second tolerance for clock skew
        ...(auth0Config.audience && { audience: auth0Config.audience }),
      };

      // Perform JWT verification using jose
      const payload = await performJWTVerification(
        token,
        getKey,
        verificationOptions
      );

      // Convert to our claims interface
      const baseClaims = convertToJWTClaims(payload);

      // Extract Auth0-specific claims
      const auth0Claims: Auth0JWTClaims = {
        ...baseClaims,
        // Include any custom namespace claims
        ...extractNamespaceClaims(payload),
      };

      // Add permissions only if they exist
      const permissions = extractPermissions(payload);
      if (permissions) {
        auth0Claims.permissions = permissions;
      }

      // Add optional properties only if they exist
      if (typeof payload['azp'] === 'string') {
        auth0Claims.azp = payload['azp'];
      }
      if (typeof payload['scope'] === 'string') {
        auth0Claims.scope = payload['scope'];
      }

      // Log successful verification
      logSecurityEvent(
        AuditEventType.AUTH_TOKEN_EXCHANGE_SUCCESS,
        {
          issuer,
          userId: sanitizeUserId(auth0Claims.sub),
          audience: Array.isArray(auth0Claims.aud)
            ? auth0Claims.aud.join(',')
            : auth0Claims.aud,
          scope: auth0Claims.scope
            ? sanitizeScope(auth0Claims.scope)
            : undefined,
          permissionsCount: auth0Claims.permissions?.length || 0,
          hasAuthorizedParty: Boolean(auth0Claims.azp),
        },
        context.logger,
        this.name
      );

      return auth0Claims;
    } catch (error) {
      // Enhanced error handling with Auth0-specific context
      const providerError = handleVerificationError(error, this.name, {
        issuer: extractIssuerSafely(token),
        tokenHash: createHashKey(token, 'verification'),
      });

      // Get config for logging
      const auth0Config = context.config.providers.find(
        (p): p is Auth0ProviderConfig => p.provider === 'auth0'
      );

      // Log security event for failed verification
      logSecurityEvent(
        AuditEventType.AUTH_JWT_VERIFICATION_FAILURE,
        {
          errorType: providerError.code,
          errorMessage: providerError.message,
          issuer: extractIssuerSafely(token),
          domain: auth0Config?.domain,
        },
        context.logger,
        this.name
      );

      throw providerError;
    }
  },
};

/**
 * Factory function to create an Auth0 provider instance
 * Validates config and returns the provider object
 *
 * @param config - Auth0 provider configuration
 * @returns Configured Auth0 provider instance
 */
export function createAuth0Provider(config: Auth0ProviderConfig): AuthProvider {
  validateAuth0Config(config);
  return auth0Provider;
}

/**
 * Type guard to check if claims are Auth0-specific claims
 * Useful for type narrowing in application code
 *
 * @param claims - JWT claims to check
 * @returns true if claims have Auth0-specific fields
 */
export function isAuth0Claims(claims: JWTClaims): claims is Auth0JWTClaims {
  return (
    'azp' in claims ||
    'scope' in claims ||
    'permissions' in claims ||
    // Check for common Auth0 namespace patterns
    Object.keys(claims).some(
      key =>
        key.startsWith('https://') ||
        (key.includes(':') &&
          !['iss', 'sub', 'aud', 'exp', 'iat', 'nbf', 'jti'].includes(key))
    )
  );
}

/**
 * Helper to extract scopes from Auth0 claims as an array
 * Handles both scope string and permissions array
 *
 * @param claims - Auth0 JWT claims
 * @returns Array of scopes/permissions
 */
export function extractAuth0Scopes(claims: Auth0JWTClaims): string[] {
  const scopes: string[] = [];

  // Add from scope string
  if (claims.scope) {
    scopes.push(
      ...claims.scope.split(' ').filter(scope => scope.trim() !== '')
    );
  }

  // Add from permissions array
  if (claims.permissions && Array.isArray(claims.permissions)) {
    scopes.push(...claims.permissions);
  }

  // Remove duplicates and return
  return Array.from(new Set(scopes));
}

/**
 * Helper to check if Auth0 token has specific scope or permission
 * Checks both scope string and permissions array
 *
 * @param claims - Auth0 JWT claims
 * @param requiredScope - Scope or permission to check for
 * @returns true if token has the required scope/permission
 */
export function hasAuth0Scope(
  claims: Auth0JWTClaims,
  requiredScope: string
): boolean {
  const allScopes = extractAuth0Scopes(claims);
  return allScopes.includes(requiredScope);
}

/**
 * Helper to check if Auth0 token has any of the specified scopes
 * Useful for authorization checks with multiple acceptable scopes
 *
 * @param claims - Auth0 JWT claims
 * @param requiredScopes - Array of acceptable scopes
 * @returns true if token has at least one of the required scopes
 */
export function hasAnyAuth0Scope(
  claims: Auth0JWTClaims,
  requiredScopes: string[]
): boolean {
  const allScopes = extractAuth0Scopes(claims);
  return requiredScopes.some(scope => allScopes.includes(scope));
}
