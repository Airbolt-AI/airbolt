import type { SSEEvent, SSEScenario } from './sse-test-server.js';

/**
 * Builder for creating custom SSE scenarios with fine-grained control
 * over timing, partial messages, and network failures.
 */
export class SSEScenarioBuilder {
  private events: SSEEvent[] = [];
  private name: string = 'custom';

  constructor(name?: string) {
    if (name) this.name = name;
  }

  /**
   * Add a standard SSE event
   */
  addEvent(type: 'start' | 'chunk' | 'done' | 'error', data: unknown): this {
    this.events.push({ type, data });
    return this;
  }

  /**
   * Add raw bytes to simulate partial messages or malformed data
   */
  addRaw(bytes: string, delayMs?: number): this {
    if (delayMs) {
      this.events.push({ type: 'delay', delayMs });
    }
    this.events.push({ type: 'raw', raw: bytes });
    return this;
  }

  /**
   * Add a delay between events
   */
  addDelay(ms: number): this {
    this.events.push({ type: 'delay', delayMs: ms });
    return this;
  }

  /**
   * Simulate connection drop
   */
  addDisconnect(afterMs?: number): this {
    if (afterMs) {
      this.events.push({ type: 'delay', delayMs: afterMs });
    }
    this.events.push({ type: 'disconnect' });
    return this;
  }

  /**
   * Split JSON at a specific byte position to test partial message handling
   */
  splitJSON(obj: unknown, splitAt: number): this {
    const json = JSON.stringify(obj);
    const part1 = json.slice(0, splitAt);
    const part2 = json.slice(splitAt);

    this.addRaw(`data: ${part1}`);
    this.addRaw(part2 + '\n\n', 50); // Small delay to simulate network
    return this;
  }

  /**
   * Add a complete chunk event with optional splitting
   */
  addChunk(
    content: string,
    options?: { splitAt?: number; delayMs?: number }
  ): this {
    if (options?.delayMs) {
      this.addDelay(options.delayMs);
    }

    if (options?.splitAt !== undefined) {
      const data = { content };
      this.addRaw('event: chunk\n');
      this.splitJSON(data, options.splitAt);
    } else {
      this.addEvent('chunk', { content });
    }
    return this;
  }

  build(): SSEScenario {
    return {
      name: this.name,
      events: this.events,
    };
  }
}

/**
 * Utilities for testing SSE streams
 */
export class SSETestUtils {
  /**
   * Collect all chunks from a stream until done or error
   */
  static async collectStream(
    streamFn: () => AsyncGenerator<{ content: string; type: string }>
  ): Promise<{ chunks: string[]; error?: Error }> {
    const chunks: string[] = [];
    let error: Error | undefined;

    try {
      for await (const chunk of streamFn()) {
        if (chunk.type === 'chunk' && chunk.content !== undefined) {
          chunks.push(chunk.content);
        } else if (chunk.type === 'done') {
          break;
        }
      }
    } catch (e) {
      error = e as Error;
    }

    return error ? { chunks, error } : { chunks };
  }

  /**
   * Create a scenario that splits JSON at every possible position
   * to thoroughly test partial message handling
   */
  static createJSONSplitScenarios(data: unknown): SSEScenario[] {
    const json = JSON.stringify(data);
    const scenarios: SSEScenario[] = [];

    for (let i = 1; i < json.length; i++) {
      const builder = new SSEScenarioBuilder(`json-split-at-${i}`);
      builder
        .addEvent('start', { type: 'start' })
        .addRaw('event: chunk\n')
        .splitJSON(data, i)
        .addEvent('done', {});

      scenarios.push(builder.build());
    }

    return scenarios;
  }

  /**
   * Simulate network conditions
   */
  static createNetworkScenario(
    type: 'flaky' | 'slow' | 'lossy',
    messages: string[]
  ): SSEScenario {
    const builder = new SSEScenarioBuilder(`network-${type}`);
    builder.addEvent('start', { type: 'start' });

    switch (type) {
      case 'flaky':
        // Connection drops and recovers
        messages.forEach((msg, i) => {
          if (i === Math.floor(messages.length / 2)) {
            builder.addDisconnect();
            return;
          }
          builder.addChunk(msg, { delayMs: Math.random() * 100 });
        });
        break;

      case 'slow':
        // Very slow delivery
        messages.forEach(msg => {
          builder.addChunk(msg, { delayMs: 500 + Math.random() * 500 });
        });
        builder.addEvent('done', {});
        break;

      case 'lossy':
        // Some chunks get fragmented
        messages.forEach((msg, i) => {
          if (i % 3 === 0) {
            // Fragment this chunk
            builder.addChunk(msg, { splitAt: Math.floor(msg.length / 2) });
          } else {
            builder.addChunk(msg);
          }
        });
        builder.addEvent('done', {});
        break;
    }

    return builder.build();
  }

  /**
   * Measure streaming performance metrics
   */
  static async measureStreamingMetrics(
    streamFn: () => AsyncGenerator<any>,
    options?: { maxDuration?: number }
  ): Promise<{
    timeToFirstChunk: number;
    totalTime: number;
    chunkCount: number;
    errorOccurred: boolean;
  }> {
    const startTime = Date.now();
    let timeToFirstChunk = -1;
    let chunkCount = 0;
    let errorOccurred = false;

    try {
      for await (const _chunk of streamFn()) {
        if (timeToFirstChunk === -1) {
          timeToFirstChunk = Date.now() - startTime;
        }
        chunkCount++;

        if (
          options?.maxDuration &&
          Date.now() - startTime > options.maxDuration
        ) {
          break;
        }
      }
    } catch {
      errorOccurred = true;
    }

    return {
      timeToFirstChunk,
      totalTime: Date.now() - startTime,
      chunkCount,
      errorOccurred,
    };
  }
}
