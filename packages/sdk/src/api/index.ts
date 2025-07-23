// Main vanilla API exports
// Streaming is the default - 'chat' is the streaming version
export { chatStream as chat, chat as chatSync } from './chat.js';
export { createChatSession } from './session.js';

// Client utility functions
export { clearAuthToken, hasValidToken, getTokenInfo } from './client-utils.js';

// Type exports
export type { Message, ChatOptions, ChatSession } from './types.js';
export type { TokenInfo } from './client-utils.js';
