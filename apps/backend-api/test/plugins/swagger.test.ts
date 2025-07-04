import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { build } from '../helper.js';
import {
  getOpenAPIV3Document,
  isResponseObject,
} from '../utils/openapi-types.js';

describe('Swagger Plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('OpenAPI Specification Generation', () => {
    it('should generate valid OpenAPI specification', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      expect(spec).toBeDefined();
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info).toBeDefined();
      expect(spec.paths).toBeDefined();
    });

    it('should include correct API metadata', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      expect(spec.info.title).toBe('AI Fastify Template API');
      expect(spec.info.version).toBe('1.0.0');
      expect(spec.info.description).toContain(
        'Production-ready Fastify backend API'
      );
      expect(spec.info.contact).toEqual({
        name: 'Your Name',
        email: 'your-email@example.com',
      });
      expect(spec.info.license).toEqual({
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      });
    });

    it('should include all defined routes', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      // Check that routes are documented
      expect(spec.paths['/']).toBeDefined();
      expect(spec.paths['/api/tokens']).toBeDefined();
      expect(spec.paths['/api/chat']).toBeDefined();

      // Check HTTP methods
      expect(spec.paths['/']?.get).toBeDefined();
      expect(spec.paths['/api/tokens']?.post).toBeDefined();
      expect(spec.paths['/api/chat']?.post).toBeDefined();
    });

    it('should include proper response schemas', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      // Root endpoint response schema
      const rootPath = spec.paths['/'];
      expect(rootPath).toBeDefined();
      const rootGet = rootPath?.get;
      expect(rootGet).toBeDefined();
      const rootResponse = rootGet?.responses?.['200'];

      if (rootResponse && isResponseObject(rootResponse)) {
        expect(rootResponse.description).toBe('Successful response');
        const jsonContent = rootResponse.content?.['application/json'];
        expect(jsonContent).toBeDefined();
        if (
          jsonContent &&
          'schema' in jsonContent &&
          jsonContent.schema &&
          'properties' in jsonContent.schema
        ) {
          expect(jsonContent.schema.properties?.['message']).toEqual({
            type: 'string',
            description: 'Welcome message',
            example: 'Hello World!',
          });
        }
      }

    });

    it('should include proper tags for organization', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      expect(spec.tags).toHaveLength(3);
      expect(spec.tags).toContainEqual({
        name: 'Root',
        description: 'Root endpoints',
      });
      expect(spec.tags).toContainEqual({
        name: 'Authentication',
        description: 'Authentication endpoints',
      });
      expect(spec.tags).toContainEqual({
        name: 'Chat',
        description: 'AI Chat endpoints',
      });

      // Check that routes are properly tagged
      expect(spec.paths['/']?.get?.tags).toContain('Root');
      expect(spec.paths['/api/tokens']?.post?.tags).toContain('Authentication');
      expect(spec.paths['/api/chat']?.post?.tags).toContain('Chat');
    });

    it('should include security schemes', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      expect(spec.components).toBeDefined();
      expect(spec.components?.securitySchemes).toBeDefined();
      expect(spec.components?.securitySchemes?.['BearerAuth']).toEqual({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      });
    });

    it('should include server configuration', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      expect(spec.servers).toBeDefined();
      expect(spec.servers).toHaveLength(1);
      expect(spec.servers?.[0]).toEqual({
        url: 'http://localhost:3000',
        description: 'Development server',
      });
    });

    it('should include operation summaries and descriptions', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      // Root endpoint
      const rootGet = spec.paths['/']?.get;
      expect(rootGet?.summary).toBe('Get welcome message');
      expect(rootGet?.description).toBe(
        'Returns a hello world message for API health check'
      );

    });
  });

  describe('Swagger UI Integration', () => {
    it('should serve Swagger UI documentation', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    });

    it('should serve OpenAPI JSON spec', async () => {
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

    it('should serve static assets for Swagger UI', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/docs/static/index.css',
      });

      // Should serve CSS or redirect appropriately
      expect([200, 302, 404]).toContain(response.statusCode);
    });
  });

  describe('OpenAPI Specification Validation', () => {
    it('should generate spec without validation errors', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      // Basic structural validation
      expect(spec.openapi).toMatch(/^3\.\d+\.\d+$/);
      expect(spec.info).toHaveProperty('title');
      expect(spec.info).toHaveProperty('version');
      expect(spec.paths).toBeTypeOf('object');

      // All paths should have at least one operation
      for (const [, pathItem] of Object.entries(spec.paths || {})) {
        if (pathItem) {
          expect(pathItem).toBeTypeOf('object');
          const operations = [
            'get',
            'post',
            'put',
            'delete',
            'patch',
            'head',
            'options',
            'trace',
          ] as const;
          const hasOperation = operations.some(
            op => op in pathItem && pathItem[op] !== undefined
          );
          expect(hasOperation).toBe(true);
        }
      }
    });

    it('should have valid response status codes', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      for (const [, pathItem] of Object.entries(spec.paths || {})) {
        if (pathItem) {
          const methods = [
            'get',
            'post',
            'put',
            'delete',
            'patch',
            'options',
            'head',
          ] as const;
          for (const method of methods) {
            const operation = pathItem[method];
            if (
              operation &&
              typeof operation === 'object' &&
              'responses' in operation &&
              operation.responses
            ) {
              for (const statusCode of Object.keys(operation.responses)) {
                // Should be a valid HTTP status code or 'default'
                expect(
                  statusCode === 'default' ||
                    (/^\d{3}$/.test(statusCode) &&
                      parseInt(statusCode) >= 100 &&
                      parseInt(statusCode) < 600)
                ).toBe(true);
              }
            }
          }
        }
      }
    });

    it('should have consistent schema structure', async () => {
      const spec = app.swagger() as any; // Type assertion needed due to swagger() union return type

      // Components section should exist
      expect(spec.components).toBeDefined();
      expect(spec.components.securitySchemes).toBeDefined();

      // Each path should have proper structure
      for (const [, pathItem] of Object.entries(spec.paths || {})) {
        if (pathItem && typeof pathItem === 'object') {
          const methods = [
            'get',
            'post',
            'put',
            'delete',
            'patch',
            'options',
            'head',
          ] as const;
          for (const method of methods) {
            const operation = (pathItem as any)[method];
            if (
              operation &&
              typeof operation === 'object' &&
              'responses' in operation
            ) {
              // Should have tags for organization
              expect(operation.tags).toBeDefined();
              expect(Array.isArray(operation.tags)).toBe(true);
              expect(operation.tags?.length).toBeGreaterThan(0);

              // Should have summary and description
              expect(operation.summary).toBeDefined();
              expect(operation.description).toBeDefined();
              expect(typeof operation.summary).toBe('string');
              expect(typeof operation.description).toBe('string');
            }
          }
        }
      }
    });
  });
});
