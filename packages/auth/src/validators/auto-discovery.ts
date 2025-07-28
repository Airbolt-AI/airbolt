import type { JWTValidator, JWTPayload, AuthConfig } from '../types.js';
import { AuthError } from '../types.js';
import { TokenValidator } from '../utils/token-validator.js';
import { ValidationPolicy } from '../utils/validation-policy.js';
import { JWKSManager } from '../utils/jwks-manager.js';
import { ProviderDetector } from '../utils/provider-detector.js';

export class AutoDiscoveryValidator implements JWTValidator {
  name = 'auto-discovery';
  private tokenValidator = new TokenValidator();
  private jwksManager = new JWKSManager();
  private policy: ValidationPolicy;

  constructor(config: AuthConfig) {
    const isProduction =
      config.NODE_ENV?.toLowerCase() === 'production' ||
      config.NODE_ENV?.toLowerCase() === 'prod';
    const validationConfig: {
      issuer?: string;
      audience?: string;
      isProduction: boolean;
    } = { isProduction };
    if (config.EXTERNAL_JWT_ISSUER)
      validationConfig.issuer = config.EXTERNAL_JWT_ISSUER;
    if (config.EXTERNAL_JWT_AUDIENCE)
      validationConfig.audience = config.EXTERNAL_JWT_AUDIENCE;
    this.policy = new ValidationPolicy(validationConfig);
  }

  canHandle(token: string): boolean {
    try {
      const decoded = this.tokenValidator.decode(token);
      const issuer = decoded.payload.iss;
      return this.policy.canHandleIssuer(issuer);
    } catch {
      return false;
    }
  }

  async verify(token: string): Promise<JWTPayload> {
    const decoded = this.tokenValidator.decode(token);
    const issuer = decoded.payload.iss;

    if (!issuer) {
      throw new AuthError(
        'Auto-discovery requires issuer claim in JWT',
        undefined,
        'External JWTs must include issuer (iss) claim for auto-discovery',
        'Check auth provider JWT configuration'
      );
    }

    // Validate issuer format
    this.policy.validateIssuer(issuer);

    try {
      // Fetch JWKS and find the right key
      const jwks = await this.jwksManager.getJWKS(issuer);
      const key = this.jwksManager.findKey(jwks, decoded.header.kid);

      if (!key) {
        throw new AuthError(
          'No matching key found in JWKS',
          undefined,
          'Token key ID (kid) not found in provider JWKS',
          'Verify token is from the correct auth provider'
        );
      }

      // Extract public key and verify token
      const publicKey = this.jwksManager.extractPublicKey(key);
      const payload = await this.tokenValidator.verify(token, publicKey);

      // Check for opaque tokens (Auth0 specific)
      if (this.policy.isOpaqueToken(payload)) {
        throw new AuthError(
          'Auth0 returned opaque token instead of JWT',
          'auth0',
          'Configure audience parameter to get JWT tokens',
          'Add audience to getAccessTokenSilently() call or Auth0Provider'
        );
      }

      // Validate audience and claims
      this.policy.validateAudience(payload);
      this.policy.validateClaims(payload);

      return payload;
    } catch (error) {
      // Enhanced error handling with provider-specific guidance
      const errorMessage =
        error instanceof AuthError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Token verification failed';

      if (error instanceof AuthError) {
        throw error; // Re-throw AuthError with full context
      }

      // Convert generic errors to AuthError with provider guidance
      ProviderDetector.getErrorMessage(errorMessage, issuer);

      // This should never be reached due to throw in getErrorMessage
      throw new AuthError(
        `Auto-discovery failed: ${errorMessage}`,
        undefined,
        'Check network connectivity and auth provider configuration',
        'Verify issuer URL and JWKS endpoint accessibility'
      );
    }
  }

  extractUserId(payload: JWTPayload): string {
    return this.tokenValidator.extractUserId(payload);
  }
}
