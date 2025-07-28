declare module 'rate-limiter-flexible' {
  export interface RateLimiterOptions {
    keyPrefix?: string;
    points: number;
    duration: number;
    execEvenly?: boolean;
  }

  export interface RateLimiterRes {
    msBeforeNext: number;
    remainingPoints: number;
    consumedPoints: number;
    isFirstInDuration: boolean;
  }

  export class RateLimiterMemory {
    constructor(opts: RateLimiterOptions);
    consume(key: string, points?: number): Promise<RateLimiterRes>;
    get(key: string): Promise<RateLimiterRes | null>;
    set(
      key: string,
      points: number,
      secDuration?: number
    ): Promise<RateLimiterRes>;
    block(key: string, secDuration: number): Promise<RateLimiterRes>;
    delete(key: string): Promise<boolean>;
    penalty(key: string, points: number): Promise<RateLimiterRes>;
    reward(key: string, points: number): Promise<RateLimiterRes>;
    getKey(key: string): string;
  }
}
