import type { AuthConfig } from '../types.js';
import { TokenValidator } from '../utils/token-validator.js';
import { ValidationPolicy } from '../utils/validation-policy.js';

export abstract class BaseValidator {
  protected tokenValidator = new TokenValidator();
  protected policy: ValidationPolicy;

  constructor(config: AuthConfig) {
    // Use 'production' string comparison for validation policy
    // This is intentional as validation policy needs exact environment matching
    const isProduction = config.NODE_ENV === 'production';
    const validationConfig: {
      issuer?: string;
      audience?: string;
      isProduction: boolean;
    } = { isProduction };
    if (config.EXTERNAL_JWT_ISSUER) {
      validationConfig.issuer = config.EXTERNAL_JWT_ISSUER;
    }
    if (config.EXTERNAL_JWT_AUDIENCE) {
      validationConfig.audience = config.EXTERNAL_JWT_AUDIENCE;
    }
    this.policy = new ValidationPolicy(validationConfig);
  }
}
