/**
 * Core SDK infrastructure
 * 
 * This module provides the foundational classes for the Airbolt SDK:
 * - TokenManager: Secure token management with automatic refresh
 * - AirboltClient: Core client with token management and error handling
 * 
 * These classes are designed to be used as building blocks for higher-level
 * abstractions like the vanilla JS API and React hooks.
 */

export { TokenManager, TokenError } from './token-manager.js';
export type { TokenManagerOptions, TokenInfo } from './token-manager.js';

export { AirboltClient, AirboltError } from './client.js';
export type { 
  AirboltClientOptions, 
  Message, 
  ChatRequest, 
  ChatResponse 
} from './client.js';