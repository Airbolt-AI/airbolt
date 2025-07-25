/**
 * @airbolt/sdk - TypeScript SDK for the Airbolt API
 *
 * This SDK provides three levels of abstraction:
 * 1. Core infrastructure (TokenManager, AirboltClient)
 * 2. Generated clients (from Fern)
 * 3. High-level utilities (vanilla JS API, React hooks)
 *
 * @since 1.0.0
 * @author Mark Watson
 * @license MIT
 */

// Export core infrastructure
export * from './core/index.js';

// Export generated client (when available)
// This will be generated by Fern and placed in the generated/ directory
// export * from './generated/index.js';

// Export API functions
// Note: 'chat' now streams by default, use 'chatSync' for non-streaming
export {
  chat,
  chatSync,
  createChatSession,
  clearAuthToken,
  hasValidToken,
  getTokenInfo,
} from './api/index.js';
export type {
  Message,
  ChatOptions,
  ChatSession,
  TokenInfo,
  UsageInfo,
  ChatResponse,
  StreamChunk,
} from './api/index.js';

// Default export for convenience
export { AirboltClient as default } from './core/fern-client.js';
