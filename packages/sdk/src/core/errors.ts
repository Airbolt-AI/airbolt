/**
 * SDK-specific error types
 */

/**
 * Error thrown when a cold start is detected.
 * This typically happens when the server needs to wake up from sleep.
 */
export class ColdStartError extends Error {
  readonly code = 'COLD_START' as const;
  override readonly name = 'ColdStartError';

  constructor(message = 'Server is starting up, please wait...') {
    super(message);
    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ColdStartError.prototype);
  }
}

/**
 * General Airbolt API error
 */
export class AirboltError extends Error {
  override readonly name = 'AirboltError';

  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string
  ) {
    super(message);
    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AirboltError.prototype);
  }
}
