import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { jwksCache } from './jwks-cache';

describe('JWKS Cache', () => {
  beforeEach(() => {
    jwksCache.clear();
  });

  afterEach(() => {
    jwksCache.clear();
  });

  it('should create JWKS verifier for valid issuer', () => {
    const issuer = 'https://test.clerk.accounts.dev';
    const jwks = jwksCache.getOrCreate(issuer);

    expect(jwks).toBeDefined();
    expect(typeof jwks).toBe('function');
    expect(jwksCache.has(issuer)).toBe(true);
    expect(jwksCache.size()).toBe(1);
  });

  it('should cache JWKS verifiers', () => {
    const issuer = 'https://test.clerk.accounts.dev';

    const jwks1 = jwksCache.getOrCreate(issuer);
    const jwks2 = jwksCache.getOrCreate(issuer);

    expect(jwks1).toBe(jwks2); // Same reference
    expect(jwksCache.size()).toBe(1);
  });

  it('should handle multiple issuers', () => {
    const issuers = [
      'https://test.clerk.accounts.dev',
      'https://test.auth0.com',
      'https://test.supabase.co',
    ];

    issuers.forEach(issuer => {
      jwksCache.getOrCreate(issuer);
    });

    expect(jwksCache.size()).toBe(3);

    issuers.forEach(issuer => {
      expect(jwksCache.has(issuer)).toBe(true);
    });
  });

  it('should clear all cached verifiers', () => {
    jwksCache.getOrCreate('https://test.clerk.accounts.dev');
    jwksCache.getOrCreate('https://test.auth0.com');

    expect(jwksCache.size()).toBe(2);

    jwksCache.clear();

    expect(jwksCache.size()).toBe(0);
    expect(jwksCache.has('https://test.clerk.accounts.dev')).toBe(false);
  });

  it('should throw for invalid URLs', () => {
    expect(() => jwksCache.getOrCreate('not-a-url')).toThrow();
    expect(() => jwksCache.getOrCreate('')).toThrow();
  });

  it('should handle issuers without protocol', () => {
    expect(() => jwksCache.getOrCreate('test.clerk.accounts.dev')).toThrow();
  });

  it('should be thread-safe for concurrent access', () => {
    const issuer = 'https://test.clerk.accounts.dev';

    // Simulate concurrent access
    const promises = Array(10)
      .fill(0)
      .map(() => Promise.resolve(jwksCache.getOrCreate(issuer)));

    return Promise.all(promises).then(results => {
      // All should return the same cached instance
      expect(results.every(jwks => jwks === results[0])).toBe(true);
      expect(jwksCache.size()).toBe(1);
    });
  });
});
