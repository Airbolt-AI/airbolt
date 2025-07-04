# SDK Architecture Decision Records

## Overview

This document captures key architectural decisions made during the SDK implementation to help future team members understand the rationale behind design choices.

## MAR-80: SDK Foundation Architecture

### Decision: Dual Environment Support (Browser + Node.js)

**Context**: The SDK needs to work seamlessly in both browser and Node.js environments.

**Decision**: Use separate Fern generators for browser and Node.js with unified core infrastructure.

**Rationale**:
- Different environments have different optimization needs
- Browser builds need smaller bundle sizes and different module formats
- Node.js builds can leverage server-side optimizations
- Unified core ensures consistent behavior across environments

**Consequences**:
- ✅ Optimal performance for each environment
- ✅ Consistent API surface across platforms
- ❌ Slightly more complex build process
- ❌ Need to maintain two generator configurations

### Decision: Environment-Agnostic Fetch Implementation

**Context**: Different environments provide fetch through different global objects.

**Decision**: Use `globalThis.fetch` instead of environment-specific polyfills.

**Rationale**:
- Modern browsers and Node.js 18+ support `globalThis.fetch`
- Eliminates need for environment detection logic
- Reduces bundle size by avoiding polyfills
- Simpler code maintenance

**Consequences**:
- ✅ Smaller bundle size
- ✅ Simpler implementation
- ✅ Future-proof approach
- ❌ Requires Node.js 18+ (acceptable constraint)

### Decision: Injectable Token Manager with Race Condition Protection

**Context**: Token management is critical for security and performance.

**Decision**: Create dedicated `TokenManager` class with promise caching for race condition protection.

**Rationale**:
- Prevents multiple concurrent token refresh requests
- Provides clean separation of concerns
- Enables dependency injection for testing
- Configurable refresh buffer prevents unnecessary API calls

**Implementation**:
```typescript
// Race condition protection pattern
if (this.refreshPromise) {
  return this.refreshPromise; // Reuse existing promise
}
this.refreshPromise = this.performTokenRefresh();
```

**Consequences**:
- ✅ Excellent performance under concurrent load
- ✅ Clean, testable architecture
- ✅ Secure token handling
- ✅ Configurable behavior

### Decision: Comprehensive Error Handling Hierarchy

**Context**: SDK needs to handle various error scenarios gracefully.

**Decision**: Create specific error classes (`TokenError`, `AirboltError`) with proper inheritance.

**Rationale**:
- Enables specific error handling by consumers
- Provides clear error categorization
- Maintains error context (status codes, causes)
- Supports debugging and logging

**Consequences**:
- ✅ Clear error handling for consumers
- ✅ Excellent debugging experience
- ✅ Proper error categorization
- ❌ Slightly more complex TypeScript types

### Decision: Zod Validation at API Boundaries

**Context**: Runtime validation is essential for SDK reliability.

**Decision**: Use Zod schemas for all API request/response validation.

**Rationale**:
- Catches type errors at runtime
- Provides clear validation error messages
- Works well with strict TypeScript configuration
- Minimal bundle size impact

**Consequences**:
- ✅ Runtime type safety
- ✅ Clear error messages
- ✅ Excellent developer experience
- ✅ Minimal performance overhead

## Testing Strategy Decisions

### Decision: Multi-Layer Testing Approach

**Layers**:
1. **Unit Tests**: Core business logic with mocked dependencies
2. **Integration Tests**: Real backend validation (conditionally skipped)
3. **Error Scenario Tests**: Network failures, validation errors, edge cases

**Rationale**:
- Unit tests provide fast feedback and high coverage
- Integration tests validate real-world scenarios
- Error scenario tests ensure robust error handling
- Conditional integration tests work with CI/CD

### Decision: Property-Based Testing for Complex Logic

**Context**: Token parsing logic handles multiple formats and edge cases.

**Decision**: Plan to add property-based testing with fast-check (MAR-96).

**Rationale**:
- Automatically discovers edge cases
- Provides better coverage than manual test cases
- Serves as executable specification
- Enhances mutation testing effectiveness

## Performance Decisions

### Decision: Exponential Backoff with Configurable Retry Logic

**Context**: Network requests can fail and need retry logic.

**Decision**: Implement exponential backoff with configurable parameters.

**Implementation**:
```typescript
const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
```

**Consequences**:
- ✅ Reduces server load during outages
- ✅ Configurable for different use cases
- ✅ Industry standard approach
- ✅ Prevents retry storms

### Decision: Request Timeout with AbortController

**Context**: Long-running requests can degrade user experience.

**Decision**: Use AbortController for configurable request timeouts.

**Rationale**:
- Modern, standards-based approach
- Works across all supported environments
- Provides clean cancellation semantics
- Prevents resource leaks

## Security Decisions

### Decision: In-Memory Token Storage with Automatic Cleanup

**Context**: Token storage needs to balance security and usability.

**Decision**: Store tokens in memory with automatic cleanup on expiration.

**Rationale**:
- Prevents token persistence to disk
- Automatic cleanup reduces exposure window
- Works consistently across environments
- Simple implementation

**Security Benefits**:
- ✅ No disk persistence
- ✅ Automatic cleanup
- ✅ No token exposure in debug methods
- ✅ Configurable expiration buffer

### Decision: Strict TypeScript Configuration

**Context**: Type safety is critical for SDK reliability.

**Decision**: Use `exactOptionalPropertyTypes` and strictest TypeScript settings.

**Consequences**:
- ✅ Maximum type safety
- ✅ Catches subtle bugs at compile time
- ✅ Excellent IDE support
- ❌ More complex error class definitions

## Future Architecture Considerations

### Fern Dependency Management

**Current State**: Heavy reliance on Fern for SDK generation.

**Future Considerations**:
- Monitor Fern ecosystem health and adoption
- Maintain documentation for manual generation process
- Consider fallback strategies if Fern becomes unavailable
- Version pinning strategy for reproducible builds

### Bundle Size Optimization

**Current State**: Functional implementation with room for optimization.

**Future Work** (MAR-97):
- Bundle analysis and size budgets
- Tree-shaking optimization
- Request deduplication for identical calls
- Dynamic imports for optional features

## Lessons Learned

### What Worked Well

1. **Iterative Development**: Building core infrastructure first enabled rapid testing
2. **Type-First Design**: TypeScript-first approach caught many issues early
3. **Comprehensive Testing**: Multiple testing layers provided confidence
4. **Clean Abstractions**: Proper separation of concerns simplified implementation

### What Could Be Improved

1. **TypeScript Complexity**: `exactOptionalPropertyTypes` created unnecessary complexity in error classes
2. **Configuration Redundancy**: Fern configuration has redundant local group (addressed in MAR-95)
3. **Bundle Analysis**: Could have established size budgets earlier

### Future Recommendations

1. **Start with Bundle Analysis**: Establish size budgets early in SDK development
2. **Progressive Enhancement**: Start with simple APIs, add complexity as needed
3. **Property-Based Testing**: Introduce early for complex logic like parsing
4. **Documentation-Driven Development**: Write architecture decisions as you go

---

*This document should be updated as new architectural decisions are made during SDK evolution.*