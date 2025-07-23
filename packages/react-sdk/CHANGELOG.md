# Changelog

## 0.5.1

### Patch Changes

- Updated dependencies []:
  - @airbolt/sdk@0.5.1

## 0.5.0

### Minor Changes

- feat(streaming): make streaming the default behavior for SDK

  BREAKING CHANGE: The `chat()` function now returns an AsyncIterator for streaming responses by default.

  **Migration Guide:**
  - If you want streaming (recommended): No changes needed, streaming is now the default
  - If you need the complete response: Replace `chat()` with `chatSync()`

  **Before:**

  ```typescript
  const response = await chat(messages); // Returns complete string
  ```

  **After:**

  ```typescript
  // Streaming (new default)
  for await (const chunk of chat(messages)) {
    console.log(chunk.content);
  }

  // Non-streaming (use chatSync)
  const response = await chatSync(messages); // Returns complete string
  ```

  This change provides better user experience with real-time responses.
  EOF < /dev/null

### Patch Changes

- Updated dependencies []:
  - @airbolt/sdk@0.5.0

## 0.4.0

### Minor Changes

- feat(sdk): add smart timeout handling for Render free tier cold starts
  - Add automatic retry with progressive timeout (60s → 120s) when cold start is detected
  - Add browser-compatible AbortSignal.timeout() polyfill for wide browser support
  - Create ColdStartError class for clear error identification
  - Add timeoutSeconds and onColdStartDetected options to AirboltClient
  - Implement session-scoped retry state (retries once per session)
  - Add comprehensive test coverage for timeout scenarios
  - Update documentation with cold start handling examples

  This improves UX for free tier deployments by gracefully handling server wake-up times without requiring backend changes.
  EOF < /dev/null

### Patch Changes

- Updated dependencies []:
  - @airbolt/sdk@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [[`1401611`](https://github.com/Airbolt-AI/airbolt/commit/14016111ed12d7e1c961c7e56f2ac5785e50278d)]:
  - @airbolt/sdk@0.3.1

## 0.3.0

### Minor Changes

- a18111b: Initial public beta release
  - Core SDK with TypeScript support and complete API client
  - React SDK with chat widget and hooks
  - Comprehensive documentation and examples
  - Beta release (0.1.0-beta.1)

### Patch Changes

- Updated dependencies [a18111b]
  - @airbolt/sdk@0.3.0

## 0.2.0

### Minor Changes

- Test release preparation automation

### Patch Changes

- Updated dependencies []:
  - @airbolt/sdk@0.2.0

## 0.1.0

### Minor Changes

- Initial public beta release with core SDK and React hooks

### Patch Changes

- Updated dependencies []:
  - @airbolt/sdk@0.1.0

All notable changes to the `@airbolt/react-sdk` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-07-07

### Added

- Initial release of `@airbolt/react-sdk`
- `useChat` hook for managing chat conversations with Airbolt API
- Full TypeScript support with exported types
- Automatic state management for messages, loading, and errors
- Built-in error recovery and retry logic
- Support for custom system prompts
- Support for initial messages
- Configurable API endpoint
- Comprehensive test coverage with unit and property-based tests
- React 16.8+ compatibility (hooks support)
- Example applications demonstrating usage
- ESM module support
