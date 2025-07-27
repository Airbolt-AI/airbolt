import type { JWTPayload, JWTValidator } from './jwt-validators.js';
import { ProviderDetector } from './provider-detector.js';
import {
  ValidationPolicy,
  type ValidationConfig,
} from './validation-policy.js';
import { JWKSManager } from './jwks-manager.js';
import { TokenValidator } from './token-validator.js';

export class AutoDiscoveryValidator implements JWTValidator {
  name = 'auto-discovery';
  private readonly validationPolicy: ValidationPolicy;
  private readonly jwksManager: JWKSManager;
  private readonly tokenValidator: TokenValidator;

  constructor(config?: {
    issuer?: string | undefined;
    audience?: string | undefined;
    isProduction?: boolean | undefined;
  }) {
    const validationConfig: ValidationConfig = {
      issuer: config?.issuer ?? undefined,
      audience: config?.audience ?? undefined,
      isProduction: config?.isProduction ?? false,
    };

    this.validationPolicy = new ValidationPolicy(validationConfig);
    this.jwksManager = new JWKSManager();
    this.tokenValidator = new TokenValidator();
  }

  canHandle(token: string): boolean {
    try {
      const decoded = this.tokenValidator.decode(token);
      const issuer = decoded.payload.iss;
      return this.validationPolicy.canHandleIssuer(issuer);
    } catch {
      return false;
    }
  }

  async verify(token: string): Promise<JWTPayload> {
    // Decode and extract basic info
    const decoded = this.tokenValidator.decode(token);
    const payload = decoded.payload;
    const issuer = payload.iss;
    const kid = decoded.header.kid;

    // Run validation policies
    this.validationPolicy.validateIssuer(issuer);
    this.validationPolicy.validateAudience(payload);

    // Check for opaque tokens
    if (this.validationPolicy.isOpaqueToken(payload)) {
      const errorMessage = ProviderDetector.getErrorMessage(
        'opaque',
        issuer || '',
        token
      );
      throw new Error(errorMessage);
    }

    // Get JWKS and find the right key
    const jwks = await this.jwksManager.getJWKS(issuer || '');
    const key = this.jwksManager.findKey(jwks, kid);
    if (!key) {
      const errorMessage = ProviderDetector.getErrorMessage(
        'No matching key found in JWKS',
        issuer || '',
        token
      );
      throw new Error(errorMessage);
    }

    // Extract public key and verify
    const publicKey = this.jwksManager.extractPublicKey(key);

    try {
      const verifiedPayload = await this.tokenValidator.verify(
        token,
        publicKey
      );

      // Validate claims after verification
      this.validationPolicy.validateClaims(verifiedPayload);

      return verifiedPayload;
    } catch (err) {
      // Enhance error messages with provider-specific details
      const errorMessage =
        err instanceof Error ? err.message : 'Token verification failed';
      throw new Error(
        ProviderDetector.getErrorMessage(errorMessage, issuer || '', token)
      );
    }
  }

  extractUserId(payload: JWTPayload): string {
    return this.tokenValidator.extractUserId(payload);
  }
}
