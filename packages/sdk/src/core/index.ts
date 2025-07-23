/**
 * Core SDK infrastructure
 *
 * This module provides the foundational classes for the Airbolt SDK:
 * - TokenManager: Secure token management with automatic refresh
 * - AirboltClient: Core client with token management and error handling (Fern-based)
 *
 * These classes are designed to be used as building blocks for higher-level
 * abstractions like the vanilla JS API and React hooks.
 */

export { TokenManager, TokenError } from './token-manager.js';
export type { TokenManagerOptions, TokenInfo } from './token-manager.js';

// Export Fern-based client
export { AirboltClient } from './fern-client.js';
export type {
  AirboltClientOptions,
  Message,
  ChatResponse,
} from './fern-client.js';

// Export errors
export {
  UnauthorizedError,
  BadRequestError,
  TooManyRequestsError,
  ServiceUnavailableError,
  AirboltAPIError,
  // Backward compatibility alias
  AirboltAPIError as AirboltError,
} from './fern-client.js';

// Export SDK-specific errors
export { ColdStartError } from './errors.js';

// Export timeout utilities
export { createTimeoutSignal, isTimeoutError } from './timeout-utils.js';

// Export URL utilities
export { joinUrl, normalizeUrl } from './url-utils.js';
