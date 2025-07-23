import type { Message } from '@airbolt/sdk';

/**
 * Utilities for testing streaming behaviors in backend tests
 */
export class SSETestUtils {
  /**
   * Collect all chunks from a streaming response
   */
  static async collectStream(
    streamFn: () => AsyncGenerator<{ content: string; type: string }>
  ): Promise<{
    chunks: string[];
    error?: Error;
  }> {
    const chunks: string[] = [];
    let error: Error | undefined;

    try {
      for await (const chunk of streamFn()) {
        if (chunk.type === 'chunk') {
          chunks.push(chunk.content);
        }
      }
    } catch (e) {
      error = e as Error;
    }

    return { chunks, error };
  }

  /**
   * Measure streaming performance metrics
   */
  static async measureStreamingMetrics(
    streamFn: () => AsyncGenerator<{ content: string; type: string }>
  ): Promise<{
    timeToFirstChunk: number;
    chunkCount: number;
    errorOccurred: boolean;
  }> {
    const startTime = Date.now();
    let timeToFirstChunk = -1;
    let chunkCount = 0;
    let errorOccurred = false;

    try {
      for await (const chunk of streamFn()) {
        if (chunk.type === 'chunk') {
          if (timeToFirstChunk === -1) {
            timeToFirstChunk = Date.now() - startTime;
          }
          chunkCount++;
        }
      }
    } catch {
      errorOccurred = true;
    }

    return {
      timeToFirstChunk: timeToFirstChunk === -1 ? Infinity : timeToFirstChunk,
      chunkCount,
      errorOccurred,
    };
  }
}
