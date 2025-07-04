/**
 * @airbolt/sdk - TypeScript SDK for the Airbolt API
 * 
 * This SDK provides three levels of abstraction:
 * 1. Core infrastructure (TokenManager, AirboltClient)
 * 2. Generated clients (from Fern)
 * 3. High-level utilities (vanilla JS API, React hooks)
 * 
 * @version 1.0.0
 * @author Mark Watson
 * @license MIT
 */

// Export core infrastructure
export * from './core/index.js';

// Export generated clients (when available)
// These will be generated by Fern and placed in the generated/ directory
export * from './generated/index.js';

// Default export for convenience
export { AirboltClient as default } from './core/client.js';