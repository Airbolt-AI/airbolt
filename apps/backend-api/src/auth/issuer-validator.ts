import { isIP } from 'node:net';
import { promisify } from 'node:util';
import { lookup } from 'node:dns';

const dnsLookup = promisify(lookup);

const CLERK_PATTERN = /^https:\/\/.*\.clerk\.accounts\.dev$/;
const AUTH0_PATTERN = /^https:\/\/.*\.auth0\.com$/;
const SUPABASE_PATTERN = /^https:\/\/.*\.supabase\.co$/;
const FIREBASE_PATTERN = /^https:\/\/securetoken\.google\.com\/.*$/;

/**
 * SSRF protection patterns and configurations
 */
const SSRF_PROTECTION = {
  // Block private IP ranges (RFC 1918)
  PRIVATE_IP_RANGES: [
    // 10.0.0.0/8
    { start: [10, 0, 0, 0], end: [10, 255, 255, 255] },
    // 172.16.0.0/12
    { start: [172, 16, 0, 0], end: [172, 31, 255, 255] },
    // 192.168.0.0/16
    { start: [192, 168, 0, 0], end: [192, 168, 255, 255] },
  ],

  // Block localhost and loopback
  LOCALHOST_PATTERNS: ['127.0.0.1', '::1', 'localhost', '0.0.0.0'],

  // Block cloud metadata endpoints
  METADATA_ENDPOINTS: [
    '169.254.169.254', // AWS, GCP, Azure metadata
    '169.254.169.253', // AWS link-local
    '100.100.100.200', // Alibaba Cloud
    'metadata.google.internal',
  ],

  // Block other dangerous addresses
  DANGEROUS_ADDRESSES: ['0.0.0.0', '255.255.255.255'],
} as const;

/**
 * Checks if an IPv4 address falls within a private range
 */
function isPrivateIPv4(ip: string): boolean {
  if (!isIP(ip) || isIP(ip) !== 4) return false;

  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;

  return SSRF_PROTECTION.PRIVATE_IP_RANGES.some(range => {
    for (let i = 0; i < 4; i++) {
      // eslint-disable-next-line security/detect-object-injection -- Safe array access with bounded index
      const part = parts[i];
      // eslint-disable-next-line security/detect-object-injection -- Safe array access with bounded index
      const rangeStart = range.start[i];
      // eslint-disable-next-line security/detect-object-injection -- Safe array access with bounded index
      const rangeEnd = range.end[i];

      if (
        part === undefined ||
        rangeStart === undefined ||
        rangeEnd === undefined
      ) {
        return false;
      }

      if (part < rangeStart || part > rangeEnd) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Checks if an address is a localhost/loopback address
 */
function isLocalhost(address: string): boolean {
  return SSRF_PROTECTION.LOCALHOST_PATTERNS.some(
    pattern => address.toLowerCase() === pattern.toLowerCase()
  );
}

/**
 * Checks if an address is a cloud metadata endpoint
 */
function isMetadataEndpoint(address: string): boolean {
  return SSRF_PROTECTION.METADATA_ENDPOINTS.some(
    endpoint => address.toLowerCase() === endpoint.toLowerCase()
  );
}

/**
 * Checks if an address is considered dangerous
 */
function isDangerousAddress(address: string): boolean {
  return SSRF_PROTECTION.DANGEROUS_ADDRESSES.some(
    dangerous => address === dangerous
  );
}

/**
 * Validates that a hostname/IP is safe to make outbound requests to.
 * Prevents SSRF attacks by blocking internal networks, localhost, and metadata endpoints.
 */
async function validateSSRFSafety(hostname: string): Promise<void> {
  // Check if hostname is already an IP
  const ipVersion = isIP(hostname);

  if (ipVersion) {
    // Direct IP validation
    if (isPrivateIPv4(hostname)) {
      throw new Error(
        `SSRF protection: Private IP address blocked: ${hostname}`
      );
    }

    if (isLocalhost(hostname)) {
      throw new Error(
        `SSRF protection: Localhost address blocked: ${hostname}`
      );
    }

    if (isMetadataEndpoint(hostname)) {
      throw new Error(
        `SSRF protection: Metadata endpoint blocked: ${hostname}`
      );
    }

    if (isDangerousAddress(hostname)) {
      throw new Error(
        `SSRF protection: Dangerous address blocked: ${hostname}`
      );
    }

    return;
  }

  // Hostname validation - check for suspicious patterns
  if (isLocalhost(hostname)) {
    throw new Error(`SSRF protection: Localhost hostname blocked: ${hostname}`);
  }

  if (isMetadataEndpoint(hostname)) {
    throw new Error(`SSRF protection: Metadata endpoint blocked: ${hostname}`);
  }

  // Resolve hostname to IP and validate
  try {
    const { address } = await dnsLookup(hostname);

    if (isPrivateIPv4(address)) {
      throw new Error(
        `SSRF protection: Hostname resolves to private IP: ${hostname} -> ${address}`
      );
    }

    if (isLocalhost(address)) {
      throw new Error(
        `SSRF protection: Hostname resolves to localhost: ${hostname} -> ${address}`
      );
    }

    if (isMetadataEndpoint(address)) {
      throw new Error(
        `SSRF protection: Hostname resolves to metadata endpoint: ${hostname} -> ${address}`
      );
    }

    if (isDangerousAddress(address)) {
      throw new Error(
        `SSRF protection: Hostname resolves to dangerous address: ${hostname} -> ${address}`
      );
    }
  } catch (error) {
    // DNS resolution failed - could be a sign of DNS manipulation
    if (error instanceof Error && error.message.includes('SSRF protection')) {
      throw error; // Re-throw our SSRF protection errors
    }
    throw new Error(`Invalid hostname: DNS resolution failed for ${hostname}`);
  }
}

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
  externalJwtIssuer?: string,
  constantTimeCompare?: (a: string, b: string) => boolean
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

  // Check if it matches configured custom issuer using constant-time comparison
  if (externalJwtIssuer) {
    const isMatch = constantTimeCompare
      ? constantTimeCompare(externalJwtIssuer, issuer)
      : externalJwtIssuer === issuer;

    if (isMatch) {
      return IssuerType.CUSTOM;
    }
  }

  return IssuerType.UNKNOWN;
}

export async function validateIssuerBeforeNetwork(
  issuer: string,
  externalJwtIssuer?: string,
  constantTimeCompare?: (a: string, b: string) => boolean
): Promise<void> {
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

  // SSRF protection - validate hostname is safe for outbound requests
  await validateSSRFSafety(url.hostname);

  const type = detectIssuerType(issuer, externalJwtIssuer, constantTimeCompare);
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
