# Changelog

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

## 0.3.1

### Patch Changes

- [#48](https://github.com/Airbolt-AI/airbolt/pull/48) [`1401611`](https://github.com/Airbolt-AI/airbolt/commit/14016111ed12d7e1c961c7e56f2ac5785e50278d) Thanks [@mkwatson](https://github.com/mkwatson)! - Fix URL construction when baseURL has trailing slashes
  - Prevents double slashes (e.g., `//api/tokens`) when baseURL ends with `/`
  - Handles multiple trailing slashes correctly
  - Fixes 404 errors on deployed instances where users provide URLs with trailing slashes

## 0.3.0

### Minor Changes

- a18111b: Initial public beta release
  - Core SDK with TypeScript support and complete API client
  - React SDK with chat widget and hooks
  - Comprehensive documentation and examples
  - Beta release (0.1.0-beta.1)

## 0.2.0

### Minor Changes

- Test release preparation automation

## 0.1.0

### Minor Changes

- Initial public beta release with core SDK and React hooks

All notable changes to the AI Fastify Template SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial SDK implementation using Fern generation
- Type-safe TypeScript client for AI Fastify Template API
- Comprehensive error handling and response types
- Full OpenAPI 3.0 compliance

### Features

- `AiFastifyTemplateAPI` client class
- Root endpoint: `getRootMessage()`
- Example endpoint: `getExampleMessage()`
- Structured error responses
- Development and production environment support

## [1.0.0] - 2025-01-01

### Added

- Initial release of the AI Fastify Template SDK
- Generated from OpenAPI specification using Fern
- Full TypeScript support with type safety
- Comprehensive documentation and examples

### SDK Features

- Zero-configuration client setup
- Promise-based API with async/await support
- Automatic request/response validation
- Comprehensive error handling
- IntelliSense and autocomplete support

### API Coverage

- Health check endpoint (`/`)
- Example endpoint (`/example/`)
- Error response handling
- JWT authentication support (when configured)

---

## SDK Versioning Strategy

This SDK follows semantic versioning:

- **MAJOR** version when you make incompatible API changes
- **MINOR** version when you add functionality in a backwards compatible manner
- **PATCH** version when you make backwards compatible bug fixes

### Automatic Versioning

The SDK version is automatically managed through:

1. **API Changes**: When the OpenAPI specification changes, the SDK is regenerated
2. **Breaking Changes**: Major version bumps for incompatible API changes
3. **New Features**: Minor version bumps for new endpoints or functionality
4. **Bug Fixes**: Patch version bumps for fixes and improvements

### Release Process

1. **API Development**: Changes made to the Fastify API
2. **OpenAPI Generation**: Specification updated automatically
3. **SDK Generation**: Fern regenerates the TypeScript SDK
4. **Version Calculation**: Semantic version determined from API changes
5. **Publication**: SDK published to NPM registry
6. **Changelog Update**: This file updated with release notes

### Compatibility Matrix

| SDK Version | API Version | Node.js Version | TypeScript Version |
| ----------- | ----------- | --------------- | ------------------ |
| 1.x.x       | 1.x.x       | ≥18.0.0         | ≥4.9.0             |

---

_This changelog is automatically maintained by the SDK generation pipeline._
