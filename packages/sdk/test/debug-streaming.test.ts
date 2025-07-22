import { describe, it } from 'vitest';
import { SSETestServer } from '@airbolt/test-utils';
import { chatStream } from '../src/api/chat.js';

describe('Debug Streaming', () => {
  it('debug error mid stream', async () => {
    const server = new SSETestServer();
    await server.start();

    server.useScenario('errorMidStream');

    const chunks: string[] = [];
    let error: Error | undefined;

    try {
      for await (const chunk of chatStream(
        [{ role: 'user', content: 'Test' }],
        { baseURL: server.url }
      )) {
        console.log('Received chunk:', chunk);
        if (chunk.type === 'chunk') {
          chunks.push(chunk.content);
        } else if (chunk.type === 'error') {
          console.log('Got error chunk:', chunk);
        }
      }
    } catch (e) {
      console.log('Caught error:', e);
      error = e as Error;
    }

    console.log('Final chunks:', chunks);
    console.log('Error:', error);

    await server.stop();
  });
});
