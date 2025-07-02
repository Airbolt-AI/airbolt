import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from '../helper.js';
import {
  getOpenAPIV3Document,
  isResponseObject,
  getPathOperations,
} from '../utils/openapi-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('SDK Integration', () => {
  let app: FastifyInstance;
  let serverUrl: string;

  beforeAll(async () => {
    app = await build({
      logger: false,
    });

    // Start server for integration testing
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server address');
    }
    serverUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('OpenAPI Specification Quality', () => {
    it('should generate complete OpenAPI spec suitable for SDK generation', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      // Validate OpenAPI 3.0 compliance
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toBe('AI Fastify Template API');
      expect(spec.info.version).toBe('1.0.0');

      // Check required fields for SDK generation
      expect(spec.paths).toBeDefined();
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);

      // Validate each endpoint has complete documentation
      for (const [, pathItem] of Object.entries(spec.paths)) {
        if (pathItem) {
          const operations = getPathOperations(pathItem);
          for (const [, operation] of Object.entries(operations)) {
            expect(operation.summary).toBeDefined();
            expect(operation.description).toBeDefined();
            expect(operation.tags).toBeDefined();
            expect(operation.responses).toBeDefined();
            expect(operation.responses['200']).toBeDefined();
          }
        }
      }
    });

    it('should include error responses for better SDK error handling', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      // Check that routes include error responses
      const rootPath = spec.paths['/'];
      const examplePath = spec.paths['/example/'];

      expect(rootPath).toBeDefined();
      expect(examplePath).toBeDefined();

      if (rootPath && examplePath) {
        expect(rootPath.get).toBeDefined();
        expect(examplePath.get).toBeDefined();
        expect(rootPath.get?.responses?.['500']).toBeDefined();
        expect(examplePath.get?.responses?.['500']).toBeDefined();

        // Validate error response structure
        const errorResponse = rootPath.get?.responses?.['500'];
        if (errorResponse && isResponseObject(errorResponse)) {
          expect(errorResponse.description).toBe('Internal Server Error');
          expect(errorResponse.content).toBeDefined();
          expect(errorResponse.content?.['application/json']).toBeDefined();

          const jsonContent = errorResponse.content?.['application/json'];
          if (
            jsonContent &&
            'schema' in jsonContent &&
            jsonContent.schema &&
            'properties' in jsonContent.schema
          ) {
            expect(jsonContent.schema.properties?.['error']).toBeDefined();
            expect(jsonContent.schema.properties?.['message']).toBeDefined();
            expect(jsonContent.schema.properties?.['statusCode']).toBeDefined();
          }
        }
      }
    });

    it('should have consistent response content types', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      for (const [, pathItem] of Object.entries(spec.paths)) {
        if (pathItem) {
          const operations = getPathOperations(pathItem);
          for (const [, operation] of Object.entries(operations)) {
            if (operation.responses) {
              for (const [, response] of Object.entries(operation.responses)) {
                if (isResponseObject(response) && response.content) {
                  // Should have application/json content type
                  expect(response.content['application/json']).toBeDefined();
                }
              }
            }
          }
        }
      }
    });
  });

  describe('Mock SDK Client Usage', () => {
    it('should demonstrate how the generated SDK would be used', async () => {
      // This test demonstrates the expected SDK usage pattern
      // In a real scenario, this would use the actual generated SDK

      // Mock SDK client structure (represents what Fern would generate)
      class MockAiFastifyTemplateAPI {
        constructor(_config: { environment: string }) {}

        async getRootMessage(): Promise<{ message: string }> {
          const response = await app.inject({
            method: 'GET',
            url: '/',
          });
          if (response.statusCode !== 200) {
            throw new Error(
              `HTTP ${response.statusCode}: ${response.statusMessage}`
            );
          }
          return JSON.parse(response.payload);
        }

        async getExampleMessage(): Promise<string> {
          const response = await app.inject({
            method: 'GET',
            url: '/example/',
          });
          if (response.statusCode !== 200) {
            throw new Error(
              `HTTP ${response.statusCode}: ${response.statusMessage}`
            );
          }
          // The response is JSON-serialized, so parse it
          return JSON.parse(response.payload);
        }
      }

      // Test SDK usage pattern
      const client = new MockAiFastifyTemplateAPI({
        environment: serverUrl,
      });

      // Test root endpoint
      const rootResponse = await client.getRootMessage();
      expect(rootResponse).toEqual({ message: 'Hello World!' });

      // Test example endpoint
      const exampleResponse = await client.getExampleMessage();
      expect(exampleResponse).toBe('this is an example');
    });

    it('should handle errors appropriately in SDK pattern', async () => {
      class MockSDKWithErrors {
        async makeRequest(path: string) {
          const response = await app.inject({
            method: 'GET',
            url: path,
          });
          if (response.statusCode !== 200) {
            throw new SDKError(
              response.statusCode,
              response.statusMessage || 'Unknown Error',
              response.payload
            );
          }
          return JSON.parse(response.payload);
        }
      }

      class SDKError extends Error {
        constructor(
          public statusCode: number,
          public statusText: string,

          public readonly body: string
        ) {
          super(`HTTP ${statusCode}: ${statusText}`);
          this.name = 'SDKError';
        }
      }

      const client = new MockSDKWithErrors();

      // Test error handling for non-existent endpoint
      try {
        await client.makeRequest('/non-existent');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(SDKError);
        expect((error as SDKError).statusCode).toBe(404);
      }
    });
  });

  describe('Fern Configuration Validation', () => {
    it('should have valid Fern configuration structure', () => {
      const fernConfigPath = join(
        __dirname,
        '../../../../fern/fern.config.json'
      );
      expect(existsSync(fernConfigPath)).toBe(true);

      const fernConfig = JSON.parse(readFileSync(fernConfigPath, 'utf8'));
      expect(fernConfig.organization).toBe('airbolt');
      expect(fernConfig.version).toBeDefined();
    });

    it('should have valid generators configuration', () => {
      const generatorsPath = join(__dirname, '../../../../fern/generators.yml');
      expect(existsSync(generatorsPath)).toBe(true);

      const generatorsContent = readFileSync(generatorsPath, 'utf8');
      expect(generatorsContent).toContain('fernapi/fern-typescript-node-sdk');
      expect(generatorsContent).toContain('@airbolt/sdk');
      expect(generatorsContent).toContain('AirboltAPI');
    });

    it('should have API definition pointing to correct OpenAPI spec', () => {
      const apiDefPath = join(__dirname, '../../../../fern/definition/api.yml');
      expect(existsSync(apiDefPath)).toBe(true);

      const apiDef = readFileSync(apiDefPath, 'utf8');
      expect(apiDef).toContain('openapi: ../apps/backend-api/openapi.json');
    });
  });

  describe('SDK Generation Prerequisites', () => {
    it('should have all required files for SDK generation', () => {
      // Check Fern configuration files (from project root)
      expect(
        existsSync(join(__dirname, '../../../../fern/fern.config.json'))
      ).toBe(true);
      expect(
        existsSync(join(__dirname, '../../../../fern/generators.yml'))
      ).toBe(true);
      expect(
        existsSync(join(__dirname, '../../../../fern/definition/api.yml'))
      ).toBe(true);

      // Check SDK package structure
      expect(
        existsSync(join(__dirname, '../../../../packages/sdk/README.md'))
      ).toBe(true);
      expect(
        existsSync(join(__dirname, '../../../../packages/sdk/package.json'))
      ).toBe(true);
      expect(
        existsSync(join(__dirname, '../../../../packages/sdk/CHANGELOG.md'))
      ).toBe(true);
    });

    it('should have OpenAPI generation working correctly', async () => {
      // Test that we can generate OpenAPI spec programmatically
      const spec = getOpenAPIV3Document(() => app.swagger());

      // Should be valid for Fern consumption
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info.title).toBeDefined();
      expect(spec.info.version).toBeDefined();
      expect(spec.paths).toBeDefined();

      // Should have proper structure for SDK generation
      const pathCount = Object.keys(spec.paths).length;
      expect(pathCount).toBeGreaterThanOrEqual(2); // At least root and example endpoints

      // Each path should have operations
      for (const pathItem of Object.values(spec.paths)) {
        const operations = ['get', 'post', 'put', 'delete', 'patch'] as const;
        const hasOperation = operations.some(op => {
          return (
            pathItem &&
            typeof pathItem === 'object' &&
            op in pathItem &&
            pathItem[op as keyof typeof pathItem] !== undefined
          );
        });
        expect(hasOperation).toBe(true);
      }
    });

    it('should support future SDK enhancements', () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      // Should have security schemes for authentication
      expect(spec.components).toBeDefined();
      expect(spec.components?.securitySchemes).toBeDefined();
      expect(spec.components?.securitySchemes?.['bearerAuth']).toBeDefined();

      // Should have proper tagging for organization
      expect(spec.tags).toBeDefined();
      expect(spec.tags?.length).toBeGreaterThan(0);

      // Should have server configuration
      expect(spec.servers).toBeDefined();
      expect(spec.servers?.length).toBeGreaterThan(0);
    });
  });

  describe('API Documentation Quality', () => {
    it('should serve interactive documentation', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.payload).toContain('swagger');
    });

    it('should serve OpenAPI JSON specification', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs/json',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const spec = JSON.parse(response.payload);
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info.title).toBe('AI Fastify Template API');
    });
  });

  describe('Real API Endpoint Testing', () => {
    it('should have working endpoints that match OpenAPI spec', async () => {
      // Test root endpoint
      const rootResponse = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(rootResponse.statusCode).toBe(200);
      const rootData = JSON.parse(rootResponse.payload);
      expect(rootData).toEqual({ message: 'Hello World!' });

      // Test example endpoint
      const exampleResponse = await app.inject({
        method: 'GET',
        url: '/example/',
      });

      expect(exampleResponse.statusCode).toBe(200);
      // Example endpoint returns JSON-serialized string
      expect(exampleResponse.payload).toBe('"this is an example"');
    });

    it('should return consistent response types for SDK generation', async () => {
      // Test individual endpoints for their expected content types
      const rootResponse = await app.inject({ method: 'GET', url: '/' });
      expect(rootResponse.statusCode).toBe(200);
      expect(rootResponse.headers['content-type']).toContain(
        'application/json'
      );
      expect(() => JSON.parse(rootResponse.payload)).not.toThrow();

      const exampleResponse = await app.inject({
        method: 'GET',
        url: '/example/',
      });
      expect(exampleResponse.statusCode).toBe(200);
      expect(exampleResponse.headers['content-type']).toContain(
        'application/json'
      );
      // The response should be valid JSON
      expect(() => JSON.parse(exampleResponse.payload)).not.toThrow();
    });
  });
});
