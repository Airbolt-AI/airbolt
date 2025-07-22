# Streaming Test Design

## Overview

Our streaming tests focus on **real user behaviors**, not SSE formatting details. We test what actually fails in production:

1. **Connection drops** - Network interruptions mid-stream
2. **Partial messages** - JSON split across network packets
3. **Backend errors** - Server failures during streaming

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│     SDK     │────▶│ SSETestServer │────▶│ Test Handler│
│ (Real Code) │     │  (Real HTTP)  │     │ (Scenarios) │
└─────────────┘     └──────────────┘     └─────────────┘
```

### Why Real Servers Over Mocks?

- **Mocks hide bugs**: Can't test buffering, timing, or network edge cases
- **Real HTTP reveals issues**: Connection handling, chunking, backpressure
- **Our SSE parsing is critical**: We own this code, must test thoroughly

## Test Utilities

### SSETestServer

Lightweight HTTP server that simulates SSE scenarios:

```typescript
import { SSETestServer, SSE_SCENARIOS } from '@airbolt/test-utils';

const server = new SSETestServer();
await server.start();

// Use pre-built scenarios
server.setScenario(SSE_SCENARIOS.connectionDrop);
server.setScenario(SSE_SCENARIOS.partialMessage);
server.setScenario(SSE_SCENARIOS.errorMidStream);
```

### SSEScenarioBuilder

Create custom edge cases:

```typescript
import { SSEScenarioBuilder } from '@airbolt/test-utils';

const scenario = new SSEScenarioBuilder()
  .addEvent('start', { type: 'start' })
  .addRaw('event: chu') // Split event name
  .addRaw('nk\n', 100) // Complete after delay
  .addRaw('data: {"content":"Hello"}\n\n')
  .addDisconnect(50) // Simulate network drop
  .build();
```

## Test Categories

### 1. Real-World Failures (`chat-streaming-behaviors.test.ts`)

Tests the top 3 production failures:

- Connection drops with partial data
- Messages split mid-JSON
- Server errors during streaming

### 2. Edge Cases (`chat-streaming-edge-cases.test.ts`)

Tests parsing robustness:

- JSON split at every byte position
- Ultra-fragmented streams (1 byte chunks)
- Mixed valid/invalid events

### 3. E2E Integration (`streaming-e2e.test.ts`)

Tests full stack behavior:

- SDK → Backend → AI Provider flow
- Client disconnection handling
- Concurrent streams

## Writing New Streaming Tests

### Step 1: Identify the Behavior

Ask: "What would a user experience?"

- ❌ "SSE event parsing fails"
- ✅ "Chat stops mid-sentence when wifi drops"

### Step 2: Create Minimal Scenario

```typescript
const wifiDrop = new SSEScenarioBuilder()
  .addEvent('chunk', { content: 'The answer is' })
  .addDisconnect(100) // Wifi drops after 100ms
  .build();
```

### Step 3: Test User Impact

```typescript
it('should handle wifi drops gracefully', async () => {
  server.setScenario({ name: 'wifi-drop', handler: wifiDrop });

  try {
    const chunks = [];
    for await (const chunk of chatStream(messages)) {
      chunks.push(chunk.content);
    }
  } catch (error) {
    // User should see partial response
    expect(chunks).toEqual(['The answer is']);
    // And a clear error
    expect(error.message).toContain('connection');
  }
});
```

## Best Practices

1. **Test behaviors, not implementation**
   - Focus on user-visible outcomes
   - Don't test SSE format details

2. **Use real components when possible**
   - Real HTTP connections reveal real bugs
   - Mock only external dependencies (AI providers)

3. **Cover the 90% cases first**
   - Connection drops
   - Partial messages
   - Server errors
   - Everything else is edge cases

4. **Keep tests fast and deterministic**
   - Use small delays (10-50ms)
   - Avoid random data
   - Clean up resources

## Running Tests

```bash
# Run all streaming tests
pnpm test streaming

# Run with specific timeout for slow connection tests
pnpm test streaming --timeout 10000

# Debug a specific scenario
pnpm test -t "should handle connection drops"
```

## Adding New Scenarios

1. Add to `SSE_SCENARIOS` for common cases
2. Use `SSEScenarioBuilder` for one-off tests
3. Document the real-world behavior being tested

Remember: **We're testing user experiences, not protocol compliance**.
