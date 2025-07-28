import type { JWTValidator, JWTPayload, AuthConfig } from '../types.js';
import { AuthError } from '../types.js';
import { BaseValidator } from './base.js';

export class ExternalJWTValidator
  extends BaseValidator
  implements JWTValidator
{
  name = 'external-secret';

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
    const secret = this.config.EXTERNAL_JWT_SECRET;
    if (!secret) {
      throw new AuthError(
        'EXTERNAL_JWT_SECRET not configured',
        undefined,
        'Set EXTERNAL_JWT_SECRET environment variable',
        'For HS256 tokens, provide the shared secret key'
      );
    }

    const payload = await this.tokenValidator.verify(token, secret);

    // Validate issuer and audience
    this.policy.validateIssuer(payload.iss);
    this.policy.validateAudience(payload);
    this.policy.validateClaims(payload);

    return payload;
  }

  extractUserId(payload: JWTPayload): string {
    return this.tokenValidator.extractUserId(payload);
  }
}
