import type { JWTValidator, AuthConfig } from '../types.js';
import { AutoDiscoveryValidator } from './auto-discovery.js';

/**
 * Validator for Clerk JWTs using JWKS
 *
 * Extends AutoDiscoveryValidator with Clerk-specific token detection.
 * Uses the same JWKS verification flow but identifies Clerk tokens by:
 * - Development: https://xxx.clerk.accounts.dev
 * - Production: Custom domains or clerk.com
 * - Authorized party (azp) claim containing 'clerk'
 */
export class ClerkValidator
  extends AutoDiscoveryValidator
  implements JWTValidator
{
  override name = 'clerk';

  constructor(config: AuthConfig) {
    super(config);
  }

  override canHandle(token: string): boolean {
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
}
