import type { JWTValidator, JWTPayload, AuthConfig } from '../types.js';
import { TokenValidator } from '../utils/token-validator.js';
import { ValidationPolicy } from '../utils/validation-policy.js';

export class ExternalJWTValidator implements JWTValidator {
  name = 'external-secret';
  private tokenValidator = new TokenValidator();
  private policy: ValidationPolicy;

  constructor(private config: AuthConfig) {
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
    const secret = this.config.EXTERNAL_JWT_SECRET;
    if (!secret) {
      throw new Error('EXTERNAL_JWT_SECRET not configured');
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
