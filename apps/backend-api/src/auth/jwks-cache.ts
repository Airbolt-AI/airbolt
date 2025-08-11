import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

class JWKSCache {
  private cache = new Map<string, JWTVerifyGetKey>();

  getOrCreate(issuer: string): JWTVerifyGetKey {
    if (!this.cache.has(issuer)) {
      const jwksUri = new URL(`${issuer}/.well-known/jwks.json`);
      this.cache.set(
        issuer,
        createRemoteJWKSet(jwksUri, {
          timeoutDuration: 500, // Fast fail
          cooldownDuration: 600000, // 10 min cooldown
          cacheMaxAge: 86400000, // 24 hour cache
        })
      );
    }
    return this.cache.get(issuer)!;
  }

  clear(): void {
    this.cache.clear();
  }

  // For testing/monitoring
  size(): number {
    return this.cache.size;
  }

  has(issuer: string): boolean {
    return this.cache.has(issuer);
  }
}

export const jwksCache = new JWKSCache();
