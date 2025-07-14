# Contributing to Airbolt

## Testing Philosophy

**Our Goal**: Build an LLM service that never fails users due to preventable bugs.

### What Makes a Good Test?

A good test for our LLM service:

1. **Catches real production failures** - Not just theoretical bugs
2. **Runs fast** - Developers will run it frequently
3. **Fails clearly** - Points directly to the problem
4. **Tests behavior, not implementation** - Survives refactoring

### Testing Strategy

We use a **risk-based testing pyramid**:

```
Property Tests (40%) ━━━━━━━━━━━━  Complex logic, edge cases
Integration Tests (35%) ━━━━━━━━━  API contracts, workflows
Unit Tests (20%) ━━━━━  Pure functions only
Mutation Tests (5%) ━━  Critical decision points
```

## Writing Tests

### 1. Property-Based Tests (Highest Value)

Use property tests for:

- **Retry logic** - Test all failure combinations
- **Concurrency** - Race conditions, parallel requests
- **Time-based behavior** - Token expiry, rate limits
- **Data transformations** - Message formatting, sanitization

```typescript
// ✅ GOOD: Tests infinite edge cases automatically
test.prop([
  fc.array(fc.constantFrom(429, 503, 'ECONNRESET')),
  fc.integer({ min: 1, max: 5 }),
])('handles any OpenAI failure sequence', async (failures, retries) => {
  // Property: Always retries correctly or fails gracefully
});

// ❌ BAD: Only tests one scenario
test('retries on 429 error', async () => {
  mockOpenAI.failOnce(429);
  // Only tests single 429, misses combinations
});
```

### 2. Integration Tests (User Journeys)

Test complete workflows:

- **Authentication flow** - Login → Token → API call → Refresh
- **Chat conversation** - Multiple messages → Context limits → Error recovery
- **Rate limiting** - Burst requests → Rate limit → Reset window

```typescript
// ✅ GOOD: Tests real user experience
test('user can chat despite temporary OpenAI outage', async () => {
  const client = await authenticate();
  mockOpenAI.failFor(5000); // 5 second outage

  const response = await client.chat('Hello');
  expect(response).toContain('error');

  mockOpenAI.recover();
  const retry = await client.chat('Hello');
  expect(retry).toContain('Hi there');
});
```

### 3. Unit Tests (Pure Logic Only)

Reserve unit tests for:

- **Pure calculations** - No I/O, no side effects
- **Data validation** - Schema parsing, format checking
- **Utilities** - Truly isolated functions

```typescript
// ✅ GOOD: Pure function, deterministic
test('calculates exponential backoff correctly', () => {
  expect(calculateBackoff(1)).toBe(1000);
  expect(calculateBackoff(2)).toBe(2000);
  expect(calculateBackoff(3)).toBe(4000);
});

// ❌ BAD: Testing implementation details
test('OpenAI service has retry method', () => {
  expect(openAIService.retry).toBeDefined();
});
```

### 4. Mutation Testing (Surgical Verification)

Only mutate critical decision points:

- **Authentication checks** - `if (!isValid) throw`
- **Rate limit calculations** - `requests > limit`
- **Retry conditions** - `shouldRetry(error)`

Skip mutations on:

- Error messages
- Configuration objects
- Data transformations
- Logging statements

## What NOT to Test

### 1. Framework Behavior

```typescript
// ❌ BAD: Testing Fastify, not your code
test('returns 200 status', async () => {
  const res = await app.inject({ url: '/health' });
  expect(res.statusCode).toBe(200);
});
```

### 2. External Services

```typescript
// ❌ BAD: Testing OpenAI's API
test('OpenAI returns valid response', async () => {
  const response = await openai.complete(prompt);
  expect(response).toHaveProperty('choices');
});
```

### 3. Implementation Details

```typescript
// ❌ BAD: Brittle, breaks on refactor
test('stores token in localStorage', () => {
  tokenManager.save(token);
  expect(localStorage.getItem('token')).toBe(token);
});
```

## Running Tests

### Development Workflow

```bash
# While coding (instant feedback)
pnpm test:watch         # Runs affected tests on save

# Before committing
pnpm test              # Full test suite
pnpm test:property     # Property tests only

# Before pushing
pnpm ai:compliance     # Everything including mutations
```

### CI Pipeline

Tests run in stages to fail fast:

1. **Type checking** (10s) - Catches obvious errors
2. **Unit tests** (30s) - Quick feedback
3. **Property tests** (2m) - Edge case detection
4. **Integration tests** (3m) - User journey validation
5. **Mutation tests** (5m) - Only if critical files changed

## Test Quality Metrics

We measure test quality by:

1. **Mean Time to Detect (MTTD)** - How fast tests catch bugs
2. **False Positive Rate** - How often tests fail incorrectly
3. **Mutation Score** - Only for auth/retry/rate-limit logic
4. **Production Incidents** - Bugs that tests missed

## Examples of Great Tests

### 1. Retry Logic Property Test

```typescript
describe('OpenAI retry behavior', () => {
  test.prop([
    fc.array(
      fc.oneof(
        fc.constant({ code: 429, delay: 1000 }),
        fc.constant({ code: 503, delay: 0 }),
        fc.constant({ code: 'ECONNRESET', delay: 0 })
      ),
      { minLength: 0, maxLength: 10 }
    ),
    fc.boolean(), // Should eventually succeed
  ])(
    'handles any failure pattern correctly',
    async (failures, eventualSuccess) => {
      const mock = mockOpenAI.withFailures(failures, eventualSuccess);
      const result = await openAIService.complete('test');

      if (eventualSuccess && failures.length <= 3) {
        expect(result).toHaveProperty('content');
      } else {
        expect(result).toHaveProperty('error');
      }

      // Verify exponential backoff was applied
      expect(mock.delays).toEqual(
        failures.map((_, i) => Math.min(1000 * Math.pow(2, i), 10000))
      );
    }
  );
});
```

### 2. Concurrent Token Refresh Test

```typescript
describe('Token manager concurrency', () => {
  test.prop([
    fc.integer({ min: 2, max: 20 }), // Concurrent requests
    fc.integer({ min: -10, max: 60 }), // Seconds until expiry
  ])(
    'prevents token refresh race conditions',
    async (concurrent, secondsToExpiry) => {
      const tokenManager = createTokenManager();
      tokenManager.setToken(createTokenExpiring(secondsToExpiry));

      // Fire concurrent requests
      const requests = Array(concurrent)
        .fill(0)
        .map(() => tokenManager.getValidToken());

      const tokens = await Promise.all(requests);

      // All requests should get the same token
      expect(new Set(tokens).size).toBe(1);

      // Only one refresh should have happened
      expect(mockAuth.refreshCount).toBeLessThanOrEqual(1);
    }
  );
});
```

### 3. Rate Limiter Accuracy Test

```typescript
describe('Rate limiter precision', () => {
  test.prop([
    fc.array(
      fc.tuple(
        fc.integer({ min: 0, max: 60000 }), // Timestamp offset
        fc.constantFrom('user1', 'user2', 'user3') // User ID
      ),
      { minLength: 1, maxLength: 200 }
    ),
    fc.record({
      windowMs: fc.constantFrom(1000, 5000, 60000),
      max: fc.integer({ min: 1, max: 100 }),
    }),
  ])('enforces limits accurately across time windows', (requests, config) => {
    const limiter = createRateLimiter(config);
    const results = [];

    for (const [offset, userId] of requests) {
      const now = Date.now() + offset;
      results.push({
        allowed: limiter.check(userId, now),
        time: now,
        user: userId,
      });
    }

    // Verify no user exceeded their limit in any window
    for (const user of ['user1', 'user2', 'user3']) {
      const userRequests = results.filter(r => r.user === user);

      for (let i = 0; i < userRequests.length; i++) {
        const windowStart = userRequests[i].time;
        const windowEnd = windowStart + config.windowMs;
        const requestsInWindow = userRequests.filter(
          r => r.time >= windowStart && r.time < windowEnd && r.allowed
        );

        expect(requestsInWindow.length).toBeLessThanOrEqual(config.max);
      }
    }
  });
});
```

## Contributing Test Improvements

1. **Identify untested edge cases** in production logs
2. **Write a failing test** that reproduces the issue
3. **Fix the bug** with minimal code changes
4. **Verify** the test now passes
5. **Add property test** to catch similar issues

Remember: The goal isn't coverage, it's confidence that our service handles real-world chaos gracefully.
