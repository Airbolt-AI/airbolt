// Core authentication types and interfaces
export interface JWTPayload {
  userId?: string;
  sub?: string;
  user_id?: string;
  email?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  azp?: string;
  [key: string]: unknown;
}

export interface JWTValidator {
  name: string;
  canHandle(token: string): boolean;
  verify(token: string): Promise<JWTPayload>;
  extractUserId(payload: JWTPayload): string;
}

export interface JWKSKey {
  kty: string;
  use?: string;
  kid?: string;
  n?: string;
  e?: string;
  x5c?: string[];
  pem?: string;
  alg?: string;
  [key: string]: unknown;
}

export interface JWKS {
  keys: JWKSKey[];
}

export interface AuthConfig {
  NODE_ENV?: string;
  EXTERNAL_JWT_ISSUER?: string;
  EXTERNAL_JWT_PUBLIC_KEY?: string;
  EXTERNAL_JWT_SECRET?: string;
  EXTERNAL_JWT_AUDIENCE?: string;
}

export enum AuthMode {
  ANONYMOUS = 'anonymous',
  CONFIGURED_ISSUER = 'configured',
  LEGACY_KEY = 'legacy',
  AUTO_DISCOVERY = 'auto',
}

export interface ProviderHints {
  setupGuide?: string;
  configHelp?: string;
  audienceRequired?: boolean;
}

// Enhanced error class with actionable guidance
export class AuthError extends Error {
  constructor(
    message: string,
    public provider?: string,
    public hint?: string,
    public action?: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
