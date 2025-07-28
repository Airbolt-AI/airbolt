import type { JWTValidator, JWTPayload, AuthConfig } from '../types.js';
import { AuthError } from '../types.js';
import { JWKSManager } from '../utils/jwks-manager.js';
import { BaseValidator } from './base.js';

export class JWKSValidator extends BaseValidator implements JWTValidator {
  name = 'jwks-public-key';
  private jwksManager = new JWKSManager();

  constructor(private config: AuthConfig) {
    super(config);
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
        'JWT missing issuer claim',
        undefined,
        'External JWTs must include issuer (iss) claim',
        'Check auth provider JWT configuration'
      );
    }

    // Get JWKS and find the right key
    const jwks = await this.jwksManager.getJWKS(
      issuer,
      this.config.EXTERNAL_JWT_PUBLIC_KEY
    );
    const key = this.jwksManager.findKey(jwks, decoded.header.kid);

    if (!key) {
      throw new AuthError(
        'No matching key found in JWKS',
        undefined,
        'Token key ID (kid) not found in provider JWKS',
        'Check if token is from the correct auth provider'
      );
    }

    // Extract public key and verify token
    const publicKey = this.jwksManager.extractPublicKey(key);
    const payload = await this.tokenValidator.verify(token, publicKey);

    // Validate issuer, audience, and claims
    this.policy.validateIssuer(payload.iss);
    this.policy.validateAudience(payload);
    this.policy.validateClaims(payload);

    return payload;
  }

  extractUserId(payload: JWTPayload): string {
    return this.tokenValidator.extractUserId(payload);
  }
}
