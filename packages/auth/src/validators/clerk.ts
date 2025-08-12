import type { JWTValidator, AuthConfig } from '../types.js';
import { ExternalJWTValidator } from './external.js';
import { TokenValidator } from '../utils/token-validator.js';

/**
 * Validator for Clerk JWTs using JWKS auto-discovery
 *
 * Uses the ExternalJWTValidator with Clerk-specific token detection.
 * Identifies Clerk tokens by:
 * - Development: https://xxx.clerk.accounts.dev
 * - Production: Custom domains or clerk.com
 * - Authorized party (azp) claim containing 'clerk'
 */
export class ClerkValidator implements JWTValidator {
  name = 'clerk';
  private tokenValidator = new TokenValidator();
  private externalValidator: ExternalJWTValidator;

  constructor(config: AuthConfig) {
    this.externalValidator = new ExternalJWTValidator(config);
  }

  canHandle(token: string): boolean {
    try {
      const decoded = this.tokenValidator.decode(token);
      const issuer = decoded.payload.iss;

      // Check if this is a Clerk issuer
      const isClerk =
        !!issuer &&
        (issuer.includes('.clerk.accounts.dev') ||
          issuer.includes('clerk.com') ||
          // Also check for the azp (authorized party) claim which Clerk includes
          (typeof decoded.payload.azp === 'string' &&
            decoded.payload.azp.includes('clerk')));

      return isClerk;
    } catch {
      return false;
    }
  }

  async verify(token: string): Promise<import('../types.js').JWTPayload> {
    return this.externalValidator.verify(token);
  }

  extractUserId(payload: import('../types.js').JWTPayload): string {
    return this.externalValidator.extractUserId(payload);
  }
}
