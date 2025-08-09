import type { AuthConfig } from '../types.js';
import { TokenValidator } from '../utils/token-validator.js';
import { ValidationPolicy } from '../utils/validation-policy.js';
import { isProduction } from '@airbolt/config';

export abstract class BaseValidator {
  protected tokenValidator = new TokenValidator();
  protected policy: ValidationPolicy;

  constructor(config: AuthConfig) {
    // Use centralized environment utility for validation policy
    const validationConfig: {
      issuer?: string;
      audience?: string;
      isProduction: boolean;
    } = { isProduction: isProduction() };
    if (config.EXTERNAL_JWT_ISSUER) {
      validationConfig.issuer = config.EXTERNAL_JWT_ISSUER;
    }
    if (config.EXTERNAL_JWT_AUDIENCE) {
      validationConfig.audience = config.EXTERNAL_JWT_AUDIENCE;
    }
    this.policy = new ValidationPolicy(validationConfig);
  }
}
