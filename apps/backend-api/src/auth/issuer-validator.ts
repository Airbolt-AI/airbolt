const CLERK_PATTERN = /^https:\/\/.*\.clerk\.accounts\.dev$/;
const AUTH0_PATTERN = /^https:\/\/.*\.auth0\.com$/;
const SUPABASE_PATTERN = /^https:\/\/.*\.supabase\.co$/;
const FIREBASE_PATTERN = /^https:\/\/securetoken\.google\.com\/.*$/;

export enum IssuerType {
  CLERK = 'clerk',
  AUTH0 = 'auth0',
  SUPABASE = 'supabase',
  FIREBASE = 'firebase',
  CUSTOM = 'custom',
  UNKNOWN = 'unknown',
}

export function detectIssuerType(
  issuer: string,
  externalJwtIssuer?: string
): IssuerType {
  if (CLERK_PATTERN.test(issuer)) {
    return IssuerType.CLERK;
  }

  if (AUTH0_PATTERN.test(issuer)) {
    return IssuerType.AUTH0;
  }

  if (SUPABASE_PATTERN.test(issuer)) {
    return IssuerType.SUPABASE;
  }

  if (FIREBASE_PATTERN.test(issuer)) {
    return IssuerType.FIREBASE;
  }

  // Check if it matches configured custom issuer
  if (externalJwtIssuer && externalJwtIssuer === issuer) {
    return IssuerType.CUSTOM;
  }

  return IssuerType.UNKNOWN;
}

export function validateIssuerBeforeNetwork(
  issuer: string,
  externalJwtIssuer?: string
): void {
  if (!issuer || typeof issuer !== 'string') {
    throw new Error('Invalid issuer: must be a non-empty string');
  }

  // Basic URL validation
  let url: URL;
  try {
    url = new URL(issuer);
  } catch {
    throw new Error('Invalid issuer: must be a valid HTTPS URL');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Invalid issuer: must use HTTPS');
  }

  const type = detectIssuerType(issuer, externalJwtIssuer);
  if (type === IssuerType.UNKNOWN) {
    throw new Error(
      `Unknown issuer: ${issuer}. Configure EXTERNAL_JWT_ISSUER or use a supported provider (Clerk, Auth0, Supabase, Firebase).`
    );
  }
}

export function isKnownIssuerType(
  issuer: string,
  externalJwtIssuer?: string
): boolean {
  return detectIssuerType(issuer, externalJwtIssuer) !== IssuerType.UNKNOWN;
}

// For configuration and debugging
export function getSupportedIssuers(externalJwtIssuer?: string): string[] {
  const supported = [
    'Clerk (*.clerk.accounts.dev)',
    'Auth0 (*.auth0.com)',
    'Supabase (*.supabase.co)',
    'Firebase (securetoken.google.com/*)',
  ];

  if (externalJwtIssuer) {
    supported.push(`Custom (${externalJwtIssuer})`);
  }

  return supported;
}
