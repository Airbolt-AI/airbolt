import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'http';
import type { AddressInfo } from 'net';

export interface SSEEvent {
  type: 'start' | 'chunk' | 'done' | 'error' | 'raw' | 'disconnect' | 'delay';
  data?: any;
  raw?: string;
  delayMs?: number;
}

export interface SSEScenario {
  name: string;
  events: SSEEvent[];
}

/**
 * Lightweight HTTP server that simulates real SSE streaming scenarios
 * including network failures, partial messages, and timing issues.
 */
export class SSETestServer {
  private server: Server;
  private _url: string = '';
  private currentScenario: SSEScenario;

  // Pre-built scenarios for the most common production failures
  static readonly scenarios: Record<string, SSEScenario> = {
    // Network drops after partial content (20% of mobile users)
    connectionDrop: {
      name: 'connectionDrop',
      events: [
        { type: 'start', data: { type: 'start' } },
        { type: 'chunk', data: { content: 'Hello wo' } },
        { type: 'disconnect' },
      ],
    },

    // JSON split across network packets (happens with proxies/CDNs)
    partialMessage: {
      name: 'partialMessage',
      events: [
        { type: 'start', data: { type: 'start' } },
        { type: 'chunk', data: { content: 'Part 1' } },
        { type: 'raw', raw: 'event: chunk\ndata: {"cont' },
        { type: 'delay', delayMs: 100 },
        { type: 'raw', raw: 'ent": "Part 2"}\n\n' },
        { type: 'done', data: {} },
      ],
    },

    // Server error during streaming (rate limits, token limits)
    errorMidStream: {
      name: 'errorMidStream',
      events: [
        { type: 'start', data: { type: 'start' } },
        { type: 'chunk', data: { content: 'Starting to respond...' } },
        { type: 'delay', delayMs: 500 },
        {
          type: 'error',
          data: { message: 'Token limit exceeded', code: 'TOKEN_LIMIT' },
        },
      ],
    },

    // Slow start (causes user retries)
    slowStart: {
      name: 'slowStart',
      events: [
        { type: 'delay', delayMs: 3000 },
        { type: 'start', data: { type: 'start' } },
        { type: 'chunk', data: { content: 'Finally started!' } },
        { type: 'done', data: {} },
      ],
    },

    // Success case
    success: {
      name: 'success',
      events: [
        { type: 'start', data: { type: 'start' } },
        { type: 'chunk', data: { content: 'Hello' } },
        { type: 'chunk', data: { content: ' streaming' } },
        { type: 'chunk', data: { content: ' world!' } },
        { type: 'done', data: { usage: { total_tokens: 5 } } },
      ],
    },

    // Invalid SSE format (malformed by proxies)
    invalidFormat: {
      name: 'invalidFormat',
      events: [
        { type: 'raw', raw: 'event:start\n' }, // Missing space
        { type: 'raw', raw: 'data:{"type":"start"}\n\n' }, // Missing space
        { type: 'raw', raw: 'event: chunk\ndata: not-json\n\n' }, // Invalid JSON
        { type: 'done', data: {} },
      ],
    },
  } as const;

  constructor() {
    this.currentScenario = SSETestServer.scenarios['success']!;

    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      // Handle token endpoint for SDK authentication
      if (req.url === '/api/tokens' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token: 'test-token' }));
        return;
      }

      // Handle OPTIONS for CORS
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
        });
        res.end();
        return;
      }

      // Set SSE headers for chat endpoint
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
      });

      // Execute the current scenario
      void this.executeScenario(res);
    });
  }

  private async executeScenario(res: ServerResponse): Promise<void> {
    for (const event of this.currentScenario.events) {
      // Handle delay
      if (event.delayMs) {
        await new Promise(resolve => setTimeout(resolve, event.delayMs));
      }

      // Handle different event types
      switch (event.type) {
        case 'start':
        case 'chunk':
        case 'done':
        case 'error':
          const sseData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          res.write(sseData);
          break;

        case 'raw':
          // Send raw bytes (for testing partial messages)
          res.write(event.raw);
          break;

        case 'disconnect':
          // Ensure previous data is flushed before disconnecting
          res.write('');
          // Abruptly close connection
          setTimeout(() => res.destroy(), 10);
          return;

        case 'delay':
          // Already handled above
          break;
      }
    }

    // End response if not disconnected
    res.end();
  }

  useScenario(name: keyof typeof SSETestServer.scenarios): void {
    switch (name) {
      case 'connectionDrop':
        this.currentScenario = SSETestServer.scenarios['connectionDrop']!;
        break;
      case 'partialMessage':
        this.currentScenario = SSETestServer.scenarios['partialMessage']!;
        break;
      case 'errorMidStream':
        this.currentScenario = SSETestServer.scenarios['errorMidStream']!;
        break;
      case 'slowStart':
        this.currentScenario = SSETestServer.scenarios['slowStart']!;
        break;
      case 'success':
        this.currentScenario = SSETestServer.scenarios['success']!;
        break;
      case 'invalidFormat':
        this.currentScenario = SSETestServer.scenarios['invalidFormat']!;
        break;
      default:
        throw new Error(`Unknown scenario: ${name}`);
    }
  }

  setCustomScenario(scenario: SSEScenario): void {
    this.currentScenario = scenario;
  }

  async start(): Promise<void> {
    return new Promise(resolve => {
      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server.address() as AddressInfo;
        this._url = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close(err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  get url(): string {
    return this._url;
  }
}
