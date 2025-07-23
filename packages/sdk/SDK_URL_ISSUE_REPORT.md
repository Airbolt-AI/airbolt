# SDK URL Construction Issue Report

## Summary

The Fern-generated SDK has a URL construction bug that creates double slashes when the baseURL ends with trailing slashes. This affects the `/api/tokens` and `/api/chat` endpoints.

## Issue Details

### Problem

When a baseURL ends with one or more trailing slashes (e.g., `https://api.example.com//`), the generated client creates malformed URLs:

- Expected: `https://api.example.com/api/tokens`
- Actual: `https://api.example.com//api/tokens`

### Root Cause

The issue is in `/packages/sdk/generated/core/url/join.ts`:

```typescript
if (base.includes('://')) {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    // Fallback to path joining if URL is malformed
    return joinPath(base, ...segments);
  }

  for (const segment of segments) {
    const cleanSegment = trimSlashes(segment);
    if (cleanSegment) {
      // BUG: url.pathname may contain trailing slashes that aren't normalized
      url.pathname = joinPathSegments(url.pathname, cleanSegment);
    }
  }

  return url.toString();
}
```

When `new URL('https://api.example.com//')` is created, the `url.pathname` becomes `//`, which is not normalized before joining segments.

### Affected Endpoints

1. **Authentication**: `/api/tokens` - Used by TokenManager for JWT generation
2. **Chat**: `/api/chat` - Used for chat completions
3. **Root**: `/` - Not affected (doesn't use `core.url.join`)

### Test Results

Created comprehensive tests in `/packages/sdk/test/fern-url-joining.test.ts`:

- ✅ 16 tests pass (normal URL handling works)
- ❌ 5 tests fail (multiple trailing slashes and integration tests)

Key failures:

1. `https://api.example.com///` + `api/tokens` → `https://api.example.com///api/tokens` (wrong)
2. `https://api.example.com//` + `api/tokens` → `https://api.example.com//api/tokens` (wrong)
3. Unicode paths are URL-encoded (separate issue)

## Impact

### Severity: Medium

- **Production Impact**: Low - Most users don't add trailing slashes to baseURL
- **Developer Experience**: Medium - Confusing errors when baseURL has trailing slashes
- **Security**: None - Just malformed URLs that would fail

### Current Mitigation

The SDK's TokenManager has its own URL joining logic that handles this correctly:

```typescript
private joinUrl(base: string, ...segments: string[]): string {
    // Remove all trailing slashes from base
    const cleanBase = base.replace(/\/+$/, '');

    // Join segments with forward slashes
    const path = segments.join('/');

    // Ensure path starts with forward slash
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    return `${cleanBase}${cleanPath}`;
}
```

## Solutions

### Option 1: Fix in Fern (Recommended)

Report the issue to Fern so they can fix their URL joining logic:

```typescript
// Add this normalization before joining segments
if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
  url.pathname = url.pathname.replace(/\/+$/, '');
}
```

### Option 2: Override in SDK

Create a wrapper that normalizes baseURL before passing to Fern client:

```typescript
export class AirboltClient {
  constructor(options: AirboltClientOptions) {
    // Normalize baseURL to remove trailing slashes
    const normalizedOptions = {
      ...options,
      baseURL: options.baseURL.replace(/\/+$/, ''),
    };

    this.client = new AirboltAPIClient({
      baseUrl: normalizedOptions.baseURL,
      // ... other options
    });
  }
}
```

### Option 3: Document the Limitation

Add to SDK documentation:

```markdown
⚠️ **Note**: The baseURL should not end with trailing slashes.
Use `https://api.example.com` instead of `https://api.example.com/`
```

## Verification

Run the test suite to verify the issue:

```bash
pnpm vitest run packages/sdk/test/fern-url-joining.test.ts
```

## Recommendation

1. **Short term**: Implement Option 2 (normalize baseURL in our wrapper)
2. **Long term**: Report to Fern for proper fix in their generator
3. **Documentation**: Add note about trailing slashes in README

The issue is non-critical since:

- TokenManager already handles it correctly for auth
- Most users don't add trailing slashes
- The malformed URLs would fail fast with clear errors
